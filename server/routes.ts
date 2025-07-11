import { createServer, Server } from "http";
import express, { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as zfd from "zod-form-data";
import { storage } from "./storage";
import * as schema from "@shared/schema";
import crypto from "crypto";
import { db, pool } from "./db";
import { eq } from "drizzle-orm";
import { sendMagicLinkEmail } from "./email-service";
import { 
  insertRoadAssetSchema, 
  insertMaintenanceTypeSchema, 
  insertMaintenanceProjectSchema,
  insertPolicySchema,
  insertBudgetAllocationSchema,
  insertMoistureReadingSchema,
  insertAssetTypeSchema,
  insertRoadwayAssetSchema,
  insertAssetInspectionSchema,
  insertAssetMaintenanceRecordSchema,
  insertUserSchema,
  insertUserTenantSchema,
  User,
  users,
  Tenant,
  UserTenant
} from "@shared/schema";
import { weatherService } from "./weather-service";
import { getStreetViewImages, getGoogleMapsUrl, Direction } from "./street-view-service";
import { sql } from "drizzle-orm";

/**
 * Finds the closest road asset to the given coordinates
 * Returns the road asset ID or null if no road is found within the distance threshold
 */
async function findClosestRoadAsset(
  longitude: number, 
  latitude: number, 
  maxDistanceThreshold: number = 0.005,
  tenantId?: number
): Promise<number | null> {
  // Get all road assets, filtered by tenant if provided
  const allRoadAssets = await storage.getRoadAssets(tenantId);

  if (!allRoadAssets.length) {
    console.log("No road assets found in the database");
    return null;
  }

  let closestAsset = null;
  let minDistance = Number.MAX_VALUE;

  for (const asset of allRoadAssets) {
    if (asset.geometry && 
        typeof asset.geometry === 'object' &&
        'type' in asset.geometry &&
        asset.geometry.type === "LineString" && 
        'coordinates' in asset.geometry &&
        Array.isArray(asset.geometry.coordinates)) {
      // Calculate distance to each point in the line and find the minimum
      for (const point of asset.geometry.coordinates) {
        if (Array.isArray(point) && point.length >= 2) {
          const assetLong = point[0];
          const assetLat = point[1];

          // Simple Euclidean distance calculation (not accurate for geographic coordinates but works for demo)
          const distance = Math.sqrt(
            Math.pow(longitude - assetLong, 2) + 
            Math.pow(latitude - assetLat, 2)
          );

          if (distance < minDistance) {
            minDistance = distance;
            closestAsset = asset;
          }
        }
      }
    }
  }

  // Only consider the asset a match if it's within our distance threshold
  if (closestAsset && minDistance < maxDistanceThreshold) {
    console.log(`Found nearby road asset: ${closestAsset.name} (ID: ${closestAsset.id}) at distance ${minDistance}`);
    return closestAsset.id;
  }

  console.log(`No road asset found within threshold distance (${maxDistanceThreshold}) of coordinates: ${longitude}, ${latitude}`);
  return null;
}

/**
 * Uses OpenStreetMap's Nominatim API to convert coordinates to real road names and locations
 * This uses actual OSM data for accurate road identification
 */
async function reverseGeocode(longitude: number, latitude: number): Promise<{roadName: string, location: string}> {
  try {
    // Following Nominatim usage policy - identify app and add delay between requests
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;

    // Sleep for 1 second to respect Nominatim usage policy
    await new Promise(resolve => setTimeout(resolve, 1000));

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TDRIPlanner-RoadAssetManagement/1.0',
        'Accept-Language': 'en-US,en'
      }
    });

    if (!response.ok) {
      throw new Error(`OpenStreetMap API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("OSM API RESPONSE:", JSON.stringify(data));

    // Extract road info from the API response
    const address = data.address;
    let roadName = "Unknown Road";
    let location = "Unknown Location";

    // Try to find the most specific road name in the address hierarchy
    if (address) {
      // Road name priority from most to least specific
      const roadFields = [
        'road', 'street', 'highway', 'pedestrian', 'path', 'footway', 
        'cycleway', 'service', 'track', 'residential'
      ];

      // Find the first available road name
      for (const field of roadFields) {
        if (address[field]) {
          roadName = address[field];
          break;
        }
      }

      // Build location from city, county, state if available
      const locationParts = [];
      if (address.city || address.town || address.village || address.hamlet) {
        locationParts.push(address.city || address.town || address.village || address.hamlet);
      }
      if (address.county) {
        locationParts.push(address.county);
      }
      if (address.state) {
        locationParts.push(address.state);
      }

      if (locationParts.length > 0) {
        location = locationParts.join(", ");
      }
    }

    // If no road name was found, use display name as fallback
    if (roadName === "Unknown Road" && data.display_name) {
      const displayParts = data.display_name.split(',');
      if (displayParts.length > 0) {
        roadName = displayParts[0].trim();
      }
    }

    console.log(`GEOCODING: Coordinates (${longitude}, ${latitude}) resolved to "${roadName}" in "${location}"`);
    return { roadName, location };
  } catch (error) {
    console.error("Error in reverse geocoding:", error);
    // Fallback in case the API call fails
    return { 
      roadName: "Unnamed Road", 
      location: `Near (${latitude.toFixed(6)}, ${longitude.toFixed(6)})` 
    };
  }
}

import { setupAuth } from './auth';

// Extend Express Request interface to include user tenant data
declare global {
  namespace Express {
    interface Request {
      userTenants?: any[];
      userTenantIds?: number[];
    }
  }
}

// Middleware to check authentication and get user's tenant access
const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if user is authenticated via session
    if (!req.session?.isAuthenticated || !req.session?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get user data from database
    const userQuery = `
      SELECT 
        id, 
        username, 
        password, 
        full_name AS "fullName", 
        role, 
        email, 
        is_system_admin AS "isSystemAdmin", 
        current_tenant_id AS "currentTenantId"
      FROM users 
      WHERE id = $1
    `;

    const result = await pool.query(userQuery, [req.session.userId]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // Attach user to request object
    (req as any).user = user;
    next();
  } catch (error) {
    console.error('Error in requireAuth middleware:', error);
    res.status(500).json({ error: "Authentication error" });
  }
};

// Middleware to get user's accessible tenants
const getUserTenants = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "User not found" });
    }

    // System admins can access all tenants
    if (req.user.isSystemAdmin) {
      req.userTenants = await storage.getTenants();
      req.userTenantIds = req.userTenants.map(t => t.id);
    } else {
      // Regular users can only access tenants they're assigned to
      const userTenantRelationships = await storage.getUserTenants(req.user.id);
      req.userTenantIds = userTenantRelationships.map(ut => ut.tenantId);
      req.userTenants = await Promise.all(
        req.userTenantIds.map(id => storage.getTenant(id))
      ).then(tenants => tenants.filter(Boolean));
    }

    next();
  } catch (error) {
    console.error('Error getting user tenants:', error);
    res.status(500).json({ error: "Failed to get user access" });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes
  setupAuth(app);
  // Tenant Management - only return tenants the user has access to
  app.get("/api/tenants", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      let accessibleTenants = [];

      // System admins can see all tenants
      if (user.isSystemAdmin) {
        accessibleTenants = await storage.getTenants();
      } else {
        // Regular users can only see tenants they're assigned to
        const userTenantRelationships = await storage.getUserTenants(user.id);
        const tenantIds = userTenantRelationships.map(ut => ut.tenantId);

        if (tenantIds.length > 0) {
          accessibleTenants = await Promise.all(
            tenantIds.map(id => storage.getTenant(id))
          );
          // Filter out any null results
          accessibleTenants = accessibleTenants.filter(Boolean);
        }
      }

      res.json(accessibleTenants);
    } catch (error) {
      console.error("Error fetching tenants:", error);
      res.status(500).json({ error: "Failed to fetch tenants" });
    }
  });

  app.get("/api/tenants/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid tenant ID" });
      }

      const tenant = await storage.getTenant(id);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      res.json(tenant);
    } catch (error) {
      console.error(`Error fetching tenant with ID ${req.params.id}:`, error);
      res.status(500).json({ error: "Failed to fetch tenant" });
    }
  });

  app.post("/api/tenants", async (req: Request, res: Response) => {
    try {
      const tenantSchema = schema.insertTenantSchema;
      const parsedData = tenantSchema.safeParse(req.body);

      if (!parsedData.success) {
        return res.status(400).json({ error: "Invalid tenant data", details: parsedData.error.format() });
      }

      const tenant = await storage.createTenant(parsedData.data);
      res.status(201).json(tenant);
    } catch (error) {
      console.error("Error creating tenant:", error);
      res.status(500).json({ error: "Failed to create tenant" });
    }
  });

  app.put("/api/tenants/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid tenant ID" });
      }

      const tenantSchema = schema.insertTenantSchema.partial();
      const parsedData = tenantSchema.safeParse(req.body);

      if (!parsedData.success) {
        return res.status(400).json({ error: "Invalid tenant data", details: parsedData.error.format() });
      }

      const tenant = await storage.updateTenant(id, parsedData.data);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      res.json(tenant);
    } catch (error) {
      console.error(`Error updating tenant with ID ${req.params.id}:`, error);
      res.status(500).json({ error: "Failed to update tenant" });
    }
  });

  app.delete("/api/tenants/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid tenant ID" });
      }

      const success = await storage.deleteTenant(id);
      if (!success) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      res.status(204).end();
    } catch (error) {
      console.error(`Error deleting tenant with ID ${req.params.id}:`, error);
      res.status(500).json({ error: "Failed to delete tenant" });
    }
  });

  // User-Tenant Management
  app.get("/api/users/:id/tenants", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }

      const tenants = await storage.getUserTenants(userId);
      res.json(tenants);
    } catch (error) {
      console.error(`Error fetching tenants for user ${req.params.id}:`, error);
      res.status(500).json({ error: "Failed to fetch user tenants" });
    }
  });

  app.post("/api/users/:userId/tenants/:tenantId", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const tenantId = parseInt(req.params.tenantId);

      if (isNaN(userId) || isNaN(tenantId)) {
        return res.status(400).json({ error: "Invalid user ID or tenant ID" });
      }

      const schema = z.object({
        role: z.string(),
        isAdmin: z.boolean()
      });

      const parsedData = schema.safeParse(req.body);

      if (!parsedData.success) {
        return res.status(400).json({ error: "Invalid data", details: parsedData.error.format() });
      }

      const success = await storage.addUserToTenant(
        userId, 
        tenantId, 
        parsedData.data.role, 
        parsedData.data.isAdmin
      );

      if (!success) {
        return res.status(404).json({ error: "User or tenant not found" });
      }

      res.status(201).json({ message: "User added to tenant" });
    } catch (error) {
      console.error(`Error adding user ${req.params.userId} to tenant ${req.params.tenantId}:`, error);
      res.status(500).json({ error: "Failed to add user to tenant" });
    }
  });

  app.delete("/api/users/:userId/tenants/:tenantId", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const tenantId = parseInt(req.params.tenantId);

      if (isNaN(userId) || isNaN(tenantId)) {
        return res.status(400).json({ error: "Invalid user ID or tenant ID" });
      }

      const success = await storage.removeUserFromTenant(userId, tenantId);

      if (!success) {
        return res.status(404).json({ error: "User-tenant relationship not found" });
      }

      res.status(204).end();
    } catch (error) {
      console.error(`Error removing user ${req.params.userId} from tenant ${req.params.tenantId}:`, error);
      res.status(500).json({ error: "Failed to remove user from tenant" });
    }
  });

  app.put("/api/users/:userId/tenants/:tenantId", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const tenantId = parseInt(req.params.tenantId);

      if (isNaN(userId) || isNaN(tenantId)) {
        return res.status(400).json({ error: "Invalid user ID or tenant ID" });
      }

      const schema = z.object({
        role: z.string(),
        isAdmin: z.boolean()
      });

      const parsedData = schema.safeParse(req.body);

      if (!parsedData.success) {
        return res.status(400).json({ error: "Invalid data", details: parsedData.error.format() });
      }

      const success = await storage.updateUserTenantRole(
        userId, 
        tenantId, 
        parsedData.data.role, 
        parsedData.data.isAdmin
      );

      if (!success) {
        return res.status(404).json({ error: "User-tenant relationship not found" });
      }

      res.json({ message: "User-tenant relationship updated" });
    } catch (error) {
      console.error(`Error updating user ${req.params.userId} tenant ${req.params.tenantId} relationship:`, error);
      res.status(500).json({ error: "Failed to update user-tenant relationship" });
    }
  });

  app.put("/api/users/:id/current-tenant", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);

      if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }

      const schema = z.object({
        tenantId: z.number().nullable()
      });

      const parsedData = schema.safeParse(req.body);

      if (!parsedData.success) {
        return res.status(400).json({ error: "Invalid data", details: parsedData.error.format() });
      }

      const user = await storage.setUserCurrentTenant(userId, parsedData.data.tenantId);

      if (!user) {
        return res.status(404).json({ error: "User not found or tenant not accessible" });
      }

      res.json(user);
    } catch (error) {
      console.error(`Error setting current tenant for user ${req.params.id}:`, error);
      res.status(500).json({ error: "Failed to set current tenant" });
    }
  });

  // Road Assets - filter by user's accessible tenants
  app.get("/api/road-assets", requireAuth, getUserTenants, async (req: Request, res: Response) => {
    try {
      let accessibleAssets = [];

      // System admins can see all assets
      if ((req.user as any).isSystemAdmin) {
        accessibleAssets = await storage.getRoadAssets();
      } else {
        // Regular users can only see assets from tenants they're assigned to
        const tenantIds = (req.userTenantIds as number[]) || [];

        if (tenantIds.length > 0) {
          // Get assets for all accessible tenants
          accessibleAssets = await storage.getRoadAssetsByTenants(tenantIds);
        }
      }

      res.json(accessibleAssets);
    } catch (error) {
      console.error("Error getting road assets:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/road-assets/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }

      const asset = await storage.getRoadAsset(id);
      if (!asset) {
        return res.status(404).json({ message: "Road asset not found" });
      }

      res.json(asset);
    } catch (error) {
      console.error("Error getting road asset:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/road-assets", async (req: Request, res: Response) => {
    try {
      const validatedData = insertRoadAssetSchema.parse(req.body);
      const asset = await storage.createRoadAsset(validatedData);

      // Log the action
      await storage.createAuditLog({
        userId: 1, // We're using a default admin user for this demo
        username: "admin",
        action: "Created road asset",
        details: `Created ${asset.assetId}: ${asset.name} (${asset.location})`,
        ipAddress: req.ip,
        resourceType: "road_asset",
        resourceId: asset.id.toString(),
      });

      // Fetch and store rainfall data for the new road asset
      // We do this asynchronously so it doesn't block the response
      weatherService.updateRainfallData(asset).catch(err => {
        console.error(`Error fetching initial rainfall data for road asset ${asset.id}:`, err);
      });

      res.status(201).json(asset);
    } catch (error) {
      console.error("Error creating road asset:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/road-assets/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }

      const existingAsset = await storage.getRoadAsset(id);
      if (!existingAsset) {
        return res.status(404).json({ message: "Road asset not found" });
      }

      const validatedData = insertRoadAssetSchema.partial().parse(req.body);
      const updatedAsset = await storage.updateRoadAsset(id, validatedData);

      // Log the action
      await storage.createAuditLog({
        userId: 1,
        username: "admin",
        action: "Updated road asset",
        details: `Updated ${existingAsset.assetId}: ${existingAsset.name}`,
        ipAddress: req.ip,
        resourceType: "road_asset",
        resourceId: id.toString(),
      });

      res.json(updatedAsset);
    } catch (error) {
      console.error("Error updating road asset:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/road-assets/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }

      const existingAsset = await storage.getRoadAsset(id);
      if (!existingAsset) {
        return res.status(404).json({ message: "Road asset not found" });
      }

      await storage.deleteRoadAsset(id);

      // Log the action
      await storage.createAuditLog({
        userId: 1,
        username: "admin",
        action: "Deleted road asset",
        details: `Deleted ${existingAsset.assetId}: ${existingAsset.name}`,
        ipAddress: req.ip,
        resourceType: "road_asset",
        resourceId: id.toString(),
      });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting road asset:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Maintenance Types
  app.get("/api/maintenance-types", async (req: Request, res: Response) => {
    try {
      const types = await storage.getMaintenanceTypes();
      res.json(types);
    } catch (error) {
      console.error("Error getting maintenance types:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/maintenance-types/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }

      const type = await storage.getMaintenanceType(id);
      if (!type) {
        return res.status(404).json({ message: "Maintenance type not found" });
      }

      res.json(type);
    } catch (error) {
      console.error("Error getting maintenance type:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/maintenance-types", async (req: Request, res: Response) => {
    try {
      const validatedData = insertMaintenanceTypeSchema.parse(req.body);
      const type = await storage.createMaintenanceType(validatedData);

      // Log the action
      await storage.createAuditLog({
        userId: 1,
        username: "admin",
        action: "Created maintenance type",
        details: `Created maintenance type: ${type.name}`,
        ipAddress: req.ip,
        resourceType: "maintenance_type",
        resourceId: type.id.toString(),
      });

      res.status(201).json(type);
    } catch (error) {
      console.error("Error creating maintenance type:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Maintenance Projects
  app.get("/api/maintenance-projects", requireAuth, getUserTenants, async (req: Request, res: Response) => {
    try {
      let projects = [];

      // System admins can see all projects
      if ((req.user as any).isSystemAdmin) {
        projects = await storage.getMaintenanceProjects();
      } else {
        // Regular users can only see projects from tenants they're assigned to
        const tenantIds = (req.userTenantIds as number[]) || [];

        if (tenantIds.length > 0) {
          projects = await storage.getMaintenanceProjectsByTenants(tenantIds);
        }
      }

      res.json(projects);
    } catch (error) {
      console.error("Error getting maintenance projects:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/maintenance-projects", async (req: Request, res: Response) => {
    try {
      const validatedData = insertMaintenanceProjectSchema.parse(req.body);
      const project = await storage.createMaintenanceProject(validatedData);

      // Log the action
      await storage.createAuditLog({
        userId: 1,
        username: "admin",
        action: "Created maintenance project",
        details: `Created project ${project.projectId}`,
        ipAddress: req.ip,
        resourceType: "maintenance_project",
        resourceId: project.id.toString(),
      });

      res.status(201).json(project);
    } catch (error) {
      console.error("Error creating maintenance project:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Policies
  app.get("/api/policies", async (req: Request, res: Response) => {
    try {
      const policies = await storage.getPolicies();
      res.json(policies);
    } catch (error) {
      console.error("Error getting policies:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/policies", async (req: Request, res: Response) => {
    try {
      const validatedData = insertPolicySchema.parse(req.body);
      const policy = await storage.createPolicy(validatedData);

      // Log the action
      await storage.createAuditLog({
        userId: 1,
        username: "admin",
        action: "Created policy",
        details: `Created policy: ${policy.name}`,
        ipAddress: req.ip,
        resourceType: "policy",
        resourceId: policy.id.toString(),
      });

      res.status(201).json(policy);
    } catch (error) {
      console.error("Error creating policy:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Budget Allocations
  app.get("/api/budget-allocations", async (req: Request, res: Response) => {
    try {
      const budgets = await storage.getBudgetAllocations();
      res.json(budgets);
    } catch (error) {
      console.error("Error getting budget allocations:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/budget-allocations/active", async (req: Request, res: Response) => {
    try {
      const budget = await storage.getActiveBudgetAllocation();
      if (!budget) {
        return res.status(404).json({ message: "No active budget allocation found" });
      }
      res.json(budget);
    } catch (error) {
      console.error("Error getting active budget allocation:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/budget-allocations", async (req: Request, res: Response) => {
    try {
      const validatedData = insertBudgetAllocationSchema.parse(req.body);
      const budget = await storage.createBudgetAllocation(validatedData);

      // Log the action
      await storage.createAuditLog({
        userId: 1,
        username: "admin",
        action: "Created budget allocation",
        details: `Created budget: ${budget.name} for fiscal year ${budget.fiscalYear}`,
        ipAddress: req.ip,
        resourceType: "budget_allocation",
        resourceId: budget.id.toString(),
      });

      res.status(201).json(budget);
    } catch (error) {
      console.error("Error creating budget allocation:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Audit Logs
  app.get("/api/audit-logs", async (req: Request, res: Response) => {
    try {
      const logs = await storage.getAuditLogs();
      res.json(logs);
    } catch (error) {
      console.error("Error getting audit logs:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // CSV Upload for Road Assets
  app.post("/api/import/road-assets", async (req: Request, res: Response) => {
    try {
      const schema = zfd.formData({
        csvData: zfd.text(),
      });

      const { csvData } = schema.parse(req.body);

      // Parse CSV data and create road assets
      // Split by new lines first
      const lines = csvData.trim().split('\n');

      // Skip empty lines
      const nonEmptyLines = lines.filter(line => line.trim().length > 0);

      if (nonEmptyLines.length === 0) {
        throw new Error("CSV file is empty");
      }

      // Process the first line to extract headers
      // Split by commas, but be careful with quoted values that might contain commas
      const extractValues = (line: string): string[] => {
        const values: string[] = [];
        let inQuotes = false;
        let currentValue = "";

        for (let i = 0; i < line.length; i++) {
          const char = line[i];

          if (char === '"') {
            // Toggle quote state
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            // End of value
            values.push(currentValue.trim());
            currentValue = "";
          } else {
            // Part of value
            currentValue += char;
          }
        }

        // Add the last value
        values.push(currentValue.trim());

        return values;
      };

      // Extract headers from the first line
      const headers = extractValues(nonEmptyLines[0]).map(header => header.trim().toLowerCase());

      // Check if the first row is a header row by looking for expected column names
      const isFirstRowHeader = headers.some(header => 
        ['assetid', 'name', 'location', 'surfacetype', 'condition'].includes(header)
      );

      console.log("Road asset import headers:", headers);
      console.log("Is first row header:", isFirstRowHeader);

      // Determine which row to start processing from (skip header row if present)
      const startRow = isFirstRowHeader ? 1 : 0;

      let importedCount = 0;
      let errorCount = 0;
      let errorDetails: Array<{ row: number, message: string }> = [];

      for (let i = startRow; i < nonEmptyLines.length; i++) {
        try {
          // For data rows, use the same careful splitting 
          const values = extractValues(nonEmptyLines[i]);

          console.log(`Road asset row ${i} values:`, values);

          const assetData: any = {};

          // Store what we found in the row for better error messages
          const rowData: Record<string, string> = {};

          headers.forEach((header, index) => {
            const value = values[index]?.trim();
            if (!value) return;

            // Store what we found for better error reporting
            rowData[header.toLowerCase()] = value;

            switch (header.toLowerCase()) {
              case 'assetid':
                assetData.assetId = value;
                break;
              case 'name':
                assetData.name = value;
                break;
              case 'location':
                assetData.location = value;
                break;
              case 'length':
                assetData.length = parseFloat(value);
                break;
              case 'width':
                assetData.width = parseFloat(value);
                break;
              case 'surfacetype':
                assetData.surfaceType = value;
                break;
              case 'condition':
                assetData.condition = parseInt(value);
                break;
              case 'lastinspection':
                try {
                  const date = new Date(value);
                  if (isNaN(date.getTime())) {
                    throw new Error(`Invalid date format: "${value}". Try using a standard format like YYYY-MM-DD`);
                  }
                  assetData.lastInspection = date;
                } catch (err) {
                  throw new Error(`Failed to parse lastInspection date: "${value}"`);
                }
                break;
              case 'nextinspection':
                if (value) {
                  try {
                    const date = new Date(value);
                    if (isNaN(date.getTime())) {
                      throw new Error(`Invalid date format: "${value}". Try using a standard format like YYYY-MM-DD`);
                    }
                    assetData.nextInspection = date;
                  } catch (err) {
                    throw new Error(`Failed to parse nextInspection date: "${value}"`);
                  }
                }
                break;
            }
          });

          // Validate required fields
          if (!assetData.assetId) {
            throw new Error(`Missing required field: assetId`);
          }

          if (!assetData.name) {
            throw new Error(`Missing required field: name`);
          }

          if (assetData.condition === undefined || isNaN(assetData.condition)) {
            const foundValue = rowData['condition'] || 'missing';
            throw new Error(`Missing or invalid condition value: "${foundValue}" (must be a numeric value between 0-100)`);
          }

          if (assetData.condition < 0 || assetData.condition > 100) {
            throw new Error(`Condition value out of range: ${assetData.condition} (must be between 0-100)`);
          }

          // Create a simplified geometry (for Mechanicsville, VA area)
          assetData.geometry = {
            type: "LineString",
            coordinates: [
              [-77.34 + Math.random() * 0.01, 37.6 + Math.random() * 0.01],
              [-77.34 + Math.random() * 0.01, 37.6 + Math.random() * 0.01]
            ]
          };

          // Validate and create the asset
          const validatedData = insertRoadAssetSchema.parse(assetData);
          await storage.createRoadAsset(validatedData);
          importedCount++;
        } catch (error) {
          console.error(`Error importing row ${i}:`, error);
          errorCount++;

          // Adjust row number for error display to account for 1-based counting that users expect
          const displayRowNumber = i + 1;

          errorDetails.push({
            row: displayRowNumber,
            message: error instanceof Error ? error.message : "Unknown error processing row"
          });
        }
      }

      // Log the action
      await storage.createAuditLog({
        userId: 1,
        username: "admin",
        action: "Imported road assets",
        details: `Imported ${importedCount} road assets. Errors: ${errorCount}`,
        ipAddress: req.ip,
        resourceType: "road_asset",
        resourceId: "bulk-import",
      });

      res.json({ 
        success: true, 
        message: `Successfully imported ${importedCount} road assets. Errors: ${errorCount}.`,
        errors: errorDetails.map(err => ({
          message: `Row ${err.row}: ${err.message}`
        }))
      });
    } catch (error) {
      console.error("Error importing road assets:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false,
          message: "Validation error", 
          errors: error.errors.map(err => ({
            message: `${err.path.join('.')} - ${err.message}`
          }))
        });
      }
      res.status(500).json({ 
        success: false,
        message: error instanceof Error ? error.message : "Internal server error",
        errors: [{
          message: error instanceof Error ? error.message : "An unexpected error occurred"
        }]
      });
    }
  });

  // Moisture Data Import
  // Rainfall data endpoints
  app.get("/api/road-assets/:id/rainfall", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }

      const roadAsset = await storage.getRoadAsset(id);
      if (!roadAsset) {
        return res.status(404).json({ message: "Road asset not found" });
      }

      // Get rainfall data
      const rainfallData = await weatherService.getRainfallDataForRoadAsset(id);

      res.json({
        roadAssetId: id,
        roadName: roadAsset.name,
        weatherStationId: roadAsset.weatherStationId,
        weatherStationName: roadAsset.weatherStationName,
        lastRainfallUpdate: roadAsset.lastRainfallUpdate,
        rainfallData
      });
    } catch (error) {
      console.error("Error getting rainfall data:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Endpoint to update rainfall data for a specific road asset
  app.post("/api/road-assets/:id/update-rainfall", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }

      const roadAsset = await storage.getRoadAsset(id);
      if (!roadAsset) {
        return res.status(404).json({ message: "Road asset not found" });
      }

      // Update rainfall data
      const success = await weatherService.updateRainfallData(roadAsset);

      if (!success) {
        return res.status(500).json({ message: "Failed to update rainfall data" });
      }

      // Log the action
      await storage.createAuditLog({
        userId: 1,
        username: "admin",
        action: "Updated rainfall data",
        details: `Updated rainfall data for ${roadAsset.name}`,
        ipAddress: req.ip,
        resourceType: "road_asset",
        resourceId: id.toString(),
      });

      // Get updated road asset
      const updatedAsset = await storage.getRoadAsset(id);

      res.json({
        success: true,
        message: "Rainfall data updated successfully",
        roadAsset: updatedAsset
      });
    } catch (error) {
      console.error("Error updating rainfall data:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Endpoint to update rainfall data for all road assets
  app.post("/api/update-all-rainfall", async (req: Request, res: Response) => {
    try {
      // Start the update process in the background
      weatherService.updateAllRoadAssets().catch((error) => {
        console.error("Background rainfall update failed:", error);
      });

      // Log the action
      await storage.createAuditLog({
        userId: 1,
        username: "admin",
        action: "Started rainfall data update",
        details: "Started rainfall data update for all road assets",
        ipAddress: req.ip,
        resourceType: "system",
        resourceId: "rainfall-update",
      });

      res.json({
        success: true,
        message: "Rainfall data update started for all road assets"
      });
    } catch (error) {
      console.error("Error starting rainfall update:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/import/moisture-data", async (req: Request, res: Response) => {
    try {
      const schema = zfd.formData({
        csvData: zfd.text(),
      });

      const { csvData } = schema.parse(req.body);

      // Parse CSV data with moisture readings - handle potential double quotes and comma escaping
      // Split by new lines first
      const lines = csvData.trim().split('\n');

      // Skip empty lines
      const nonEmptyLines = lines.filter(line => line.trim().length > 0);

      if (nonEmptyLines.length === 0) {
        throw new Error("CSV file is empty");
      }

      // Process the first line to extract headers
      // Split by commas, but be careful with quoted values that might contain commas
      const extractValues = (line: string): string[] => {
        const values: string[] = [];
        let inQuotes = false;
        let currentValue = "";

        for (let i = 0; i < line.length; i++) {
          const char = line[i];

          if (char === '"') {
            // Toggle quote state
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            // End of value
            values.push(currentValue.trim());
            currentValue = "";
          } else {
            // Part of value
            currentValue += char;
          }
        }

        // Add the last value
        values.push(currentValue.trim());

        return values;
      };

      // Extract headers from the first line
      const headers = extractValues(nonEmptyLines[0]).map(header => header.trim().toLowerCase());

      // Check if the first row is a header row by looking for expected column names
      const isFirstRowHeader = headers.some(header => 
        ['longitude', 'latitude', 'moisture', 'value', 'readingdate', 'roadassetid'].includes(header)
      );

      console.log("Headers:", headers);
      console.log("Is first row header:", isFirstRowHeader);

      // Determine which row to start processing from (skip header row if present)
      const startRow = isFirstRowHeader ? 1 : 0;

      let importedCount = 0;
      let errorCount = 0;
      let newAssetsCreated = 0;
      let updatedAssets = new Set<number>();
      let errorDetails: Array<{ row: number, message: string }> = [];

      // Loop through data rows (skipping header if present)
      for (let i = startRow; i < nonEmptyLines.length; i++) {
        try {
          // For data rows, use the same careful splitting
          const values = extractValues(nonEmptyLines[i]);

          console.log(`Row ${i} values:`, values);

          // Extract data from the CSV line
          let longitude: number | undefined;
          let latitude: number | undefined;
          let moisture: number | undefined;
          let readingDate: Date | undefined;
          let roadAssetId: string | undefined;

          // Store what we found in the row for better error messages
          const rowData: Record<string, string> = {};

          // Check if the CSV line has enough values
          if (values.length < 3) {
            throw new Error(`Insufficient data in row (expected at least longitude, latitude, and moisture values but found only ${values.length} column(s))`);
          }

          headers.forEach((header, index) => {
            const value = values[index]?.trim();
            if (!value) return;

            // Store what we found for better error reporting
            rowData[header.toLowerCase()] = value;

            switch (header.toLowerCase()) {
              case 'longitude':
                longitude = parseFloat(value);
                break;
              case 'latitude':
                latitude = parseFloat(value);
                break;
              case 'moisture':
              case 'value':
                moisture = parseFloat(value);
                break;
              case 'readingdate':
                // Handle a variety of date formats using a more robust parsing approach
                try {
                  // Try standard Date constructor first
                  const parsedDate = new Date(value);

                  // Check if the date is valid
                  if (!isNaN(parsedDate.getTime())) {
                    readingDate = parsedDate;
                  } else {
                    // Handle formats like "2024-9-3T04:18:59 GMT+0000 (Coordinated Universal Time).000"
                    // by removing the timezone name in parentheses and handling non-standard separators
                    const cleanedValue = value
                      .replace(/\(.*\)/g, '') // Remove anything in parentheses
                      .replace(/\.(\d+)$/, 'Z') // Replace trailing milliseconds with Z
                      .trim();

                    readingDate = new Date(cleanedValue);

                    // If still invalid, try one more approach with manual parsing
                    if (isNaN(readingDate.getTime())) {
                      // Try to match various date formats with regex
                      const dateRegex = /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})[T ]?(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?/;
                      const match = value.match(dateRegex);

                      if (match) {
                        const [_, year, month, day, hour = '0', minute = '0', second = '0'] = match;
                        readingDate = new Date(
                          parseInt(year), 
                          parseInt(month) - 1, // JS months are 0-indexed
                          parseInt(day),
                          parseInt(hour),
                          parseInt(minute),
                          parseInt(second)
                        );
                      }
                    }
                  }

                  // If all parsing attempts failed, throw an error with the problematic value
                  if (readingDate === undefined || isNaN(readingDate.getTime())) {
                    throw new Error(`Invalid date format: "${value}". Try using a standard format like YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS`);
                  }
                } catch (err) {
                  console.error("Error parsing date:", value, err);
                  if (err instanceof Error && err.message.includes("Invalid date format")) {
                    // Rethrow the specific error we created above
                    throw err;
                  }
                  // For other parsing errors, provide specific feedback
                  throw new Error(`Failed to parse date: "${value}". Error: ${err instanceof Error ? err.message : "Unknown error"}`);
                }
                break;
              case 'roadassetid':
                roadAssetId = value;
                break;
            }
          });

          // Validate required fields with specific error messages that include the actual values
          if (longitude === undefined || isNaN(longitude)) {
            const foundValue = rowData['longitude'] || 'missing';
            throw new Error(`Missing or invalid longitude value: "${foundValue}" (must be a numeric value)`);
          }

          // Validate longitude range (-180 to 180 degrees)
          if (longitude < -180 || longitude > 180) {
            throw new Error(`Longitude value out of range: ${longitude} (must be between -180 and 180 degrees)`);
          }

          if (latitude === undefined || isNaN(latitude)) {
            const foundValue = rowData['latitude'] || 'missing';
            throw new Error(`Missing or invalid latitude value: "${foundValue}" (must be a numeric value)`);
          }

          // Validate latitude range (-90 to 90 degrees)
          if (latitude < -90 || latitude > 90) {
            throw new Error(`Latitude value out of range: ${latitude} (must be between -90 and 90 degrees)`);
          }

          if (moisture === undefined || isNaN(moisture)) {
            const foundValue = rowData['moisture'] || 'missing';
            throw new Error(`Missing or invalid moisture value: "${foundValue}" (must be a numeric value between 0-100)`);
          }

          // Add range validation for moisture
          if (moisture < 0 || moisture > 100) {
            throw new Error(`Moisture value out of range: ${moisture} (must be between 0-100)`);
          }

          // If no date is provided, use current date
          if (!readingDate || isNaN(readingDate.getTime())) {
            readingDate = new Date();
          }

          // Find the road asset to update, either by ID or by proximity
          let assetToUpdate;

          if (roadAssetId) {
            // If road asset ID is provided, find that specific asset
            assetToUpdate = await storage.getRoadAssetByAssetId(roadAssetId);
            if (!assetToUpdate) {
              throw new Error(`Road asset with ID ${roadAssetId} not found`);
            }
          } else {
            // Otherwise, find the nearest road asset by coordinates
            // For now, we'll just get all assets and find the closest one
            const allAssets = await storage.getRoadAssets();

            // Diagnostic logging
            console.log(`MOISTURE IMPORT DIAGNOSTIC: Processing coordinates ${longitude}, ${latitude} with moisture ${moisture}`);
            console.log(`MOISTURE IMPORT DIAGNOSTIC: Found ${allAssets.length} existing road assets`);

            // Allow import to proceed even if no assets exist - we'll create a new one

            // Find the closest asset based on the coordinates in the geometry
            // This is a simplified approach - in a production app, this would use proper geospatial calculations
            let closestAsset = null;
            let minDistance = Number.MAX_VALUE;

            // Define maximum distance threshold - any road further than this will be considered a new road
            // For lat/long, a small value like 0.005 represents roughly 500m
            const MAX_DISTANCE_THRESHOLD = 0.005;

            for (const asset of allAssets) {
              if (asset.geometry?.type === "LineString" && Array.isArray(asset.geometry.coordinates)) {
                // Calculate distance to each point in the line and find the minimum
                for (const point of asset.geometry.coordinates) {
                  if (Array.isArray(point) && point.length >= 2) {
                    const assetLong = point[0];
                    const assetLat = point[1];

                    // Simple Euclidean distance calculation (not accurate for geographic coordinates but works for demo)
                    const distance = Math.sqrt(
                      Math.pow(longitude - assetLong, 2) + 
                      Math.pow(latitude - assetLat, 2)
                    );

                    if (distance < minDistance) {
                      minDistance = distance;
                      closestAsset = asset;
                    }
                  }
                }
              }
            }

            // Log the minimum distance found for diagnostic purposes
            console.log(`MOISTURE IMPORT DIAGNOSTIC: Minimum distance to existing road: ${minDistance}`);

            // Only consider the asset a match if it's within our distance threshold
            if (closestAsset && minDistance < MAX_DISTANCE_THRESHOLD) {
              console.log(`MOISTURE IMPORT DIAGNOSTIC: Found nearby road asset: ${closestAsset.name} (ID: ${closestAsset.id}) at distance ${minDistance}`);
              assetToUpdate = closestAsset;
            } else {
              // Either no asset was found or the closest one was too far away
              // No road assets found nearby - create a new one
              console.log(`MOISTURE IMPORT DIAGNOSTIC: No matching road asset found, creating new road asset for coordinates: ${longitude}, ${latitude}`);

              // Generate a new asset ID based on coordinates
              const newAssetId = `RS-${Math.floor(1000 + Math.random() * 9000)}`;
              console.log(`MOISTURE IMPORT DIAGNOSTIC: Generated new asset ID: ${newAssetId}`);

              try {
                // Use OpenStreetMap API for real geocoding to get accurate road name and location
                const geoInfo = await reverseGeocode(longitude, latitude);
                console.log(`MOISTURE IMPORT DIAGNOSTIC: Determined road name from coordinates: "${geoInfo.roadName}" in "${geoInfo.location}"`);

                // Create a new road asset with the real location data from OpenStreetMap
                const newAssetData = {
                  assetId: newAssetId,
                  name: geoInfo.roadName,
                  location: geoInfo.location,
                  length: 0.1, // Default length
                  width: 6.0, // Default width
                  surfaceType: "Unknown",
                  condition: 80, // Default good condition
                  lastInspection: new Date(),
                  geometry: {
                    type: "LineString",
                    coordinates: [
                      [longitude, latitude],
                      [longitude + 0.001, latitude + 0.001]
                    ]
                  }
                };

                console.log(`MOISTURE IMPORT DIAGNOSTIC: Attempting to create new asset with data:`, newAssetData);
                const newAsset = await storage.createRoadAsset(newAssetData);
                console.log(`MOISTURE IMPORT DIAGNOSTIC: Successfully created new road asset with ID: ${newAsset.id}`);

                assetToUpdate = newAsset;
              } catch (createError) {
                console.error(`MOISTURE IMPORT DIAGNOSTIC: Failed to create new road asset:`, createError);
                throw new Error(`Failed to create new road asset: ${createError instanceof Error ? createError.message : "Unknown error"}`);
              }
              // Increment the counter for new assets created
              newAssetsCreated++;
            }
          }

          // Create a moisture reading with coordinates
          if (assetToUpdate) {
            // Create new moisture reading record
            const moistureReading = await storage.createMoistureReading({
              roadAssetId: assetToUpdate.id,
              latitude: latitude,
              longitude: longitude,
              moistureValue: moisture,
              readingDate: readingDate
            });

            // Update the last moisture reading timestamp on the road asset
            const updatedAsset = await storage.updateRoadAsset(assetToUpdate.id, {
              lastMoistureReading: readingDate
            });

            if (moistureReading && updatedAsset) {
              importedCount++;
              updatedAssets.add(assetToUpdate.id);
            } else {
              throw new Error(`Failed to create moisture reading for road asset with ID ${assetToUpdate.id}`);
            }
          }
        } catch (error) {
          console.error(`Error importing moisture data row ${i}:`, error);
          errorCount++;
          // Adjust row number for error display to account for 1-based counting that users expect
          // and potentially skipped header row
          const displayRowNumber = i + 1;

          errorDetails.push({
            row: displayRowNumber,
            message: error instanceof Error ? error.message : "Unknown error processing row"
          });
        }
      }

      // Calculate existing assets (total minus new ones)
      const existingAssetsUpdated = updatedAssets.size - newAssetsCreated;

      // Log the action
      await storage.createAuditLog({
        userId: 1,
        username: "admin",
        action: "Imported moisture data",
        details: `Created ${newAssetsCreated} new road assets and added ${importedCount} detailed moisture readings with coordinates to ${existingAssetsUpdated} existing assets. Errors: ${errorCount}`,
        ipAddress: req.ip,
        resourceType: "moisture_reading",
        resourceId: "moisture-import",
      });

      res.json({ 
        success: true, 
        message: `Successfully imported ${importedCount} detailed moisture readings with coordinates, creating ${newAssetsCreated} new road assets and updating ${existingAssetsUpdated} existing assets. Errors: ${errorCount}.`,
        errors: errorDetails.map(err => ({
          message: `Row ${err.row}: ${err.message}`
        }))
      });
    } catch (error) {
      console.error("Error importing moisture data:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false,
          message: "Validation error", 
          errors: error.errors.map(err => ({
            message: `${err.path.join('.')} - ${err.message}`
          }))
        });
      }
      res.status(500).json({ 
        success: false,
        message: error instanceof Error ? error.message : "Internal server error",
        errors: [{
          message: error instanceof Error ? error.message : "An unexpected error occurred"
        }]
      });
    }
  });

  // Moisture Readings Routes
  app.get("/api/moisture-readings", async (req: Request, res: Response) => {
    try {
      // Parse query parameters for pagination and filtering
      const limit = parseInt(req.query.limit as string) || 100; // Default limit of 100 per asset
      const page = parseInt(req.query.page as string) || 1;
      const offset = (page - 1) * limit;

      // Get all road assets with moisture readings
      const roadAssets = await storage.getRoadAssets();
      const assetsWithMoisture = roadAssets.filter(asset => asset.lastMoistureReading !== null);

      // Create a response map of roadAssetId -> moisture readings (limited)
      const responseMap: Record<number, any[]> = {};

      // Get moisture readings for each asset (limited to reduce data transfer)
      await Promise.all(
        assetsWithMoisture.map(async (asset) => {
          const readings = await storage.getMoistureReadings(asset.id);
          if (readings.length > 0) {
            // Only return the most recent readings based on limit
            responseMap[asset.id] = readings.slice(offset, offset + limit);
          }
        })
      );

      res.json(responseMap);
    } catch (error) {
      console.error("Error getting all moisture readings:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // New optimized endpoint for map view - only gets latest moisture reading per asset
  app.get("/api/moisture-readings/latest", async (req: Request, res: Response) => {
    try {
      // Use the optimized storage method to get latest readings with spatial filtering
      const bounds = req.query.bounds as string;
      const latestReadings = await storage.getLatestMoistureReadings(bounds);
      res.json(latestReadings);
    } catch (error) {
      console.error("Error getting latest moisture readings:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/road-assets/:id/moisture-readings", async (req: Request, res: Response) => {
    try {
      const roadAssetId = parseInt(req.params.id);
      if (isNaN(roadAssetId)) {
        return res.status(400).json({ message: "Invalid road asset ID" });
      }

      const roadAsset = await storage.getRoadAsset(roadAssetId);
      if (!roadAsset) {
        return res.status(404).json({ message: "Road asset not found" });
      }

      const moistureReadings = await storage.getMoistureReadings(roadAssetId);
      res.json(moistureReadings);
    } catch (error) {
      console.error("Error getting moisture readings:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get moisture hotspots (top 5% moisture readings) for a specific road asset
  app.get("/api/road-assets/:id/moisture-hotspots", async (req: Request, res: Response) => {
    try {
      const roadAssetId = parseInt(req.params.id);
      if (isNaN(roadAssetId)) {
        return res.status(400).json({ message: "Invalid road asset ID" });
      }

      const roadAsset = await storage.getRoadAsset(roadAssetId);
      if (!roadAsset) {
        return res.status(404).json({ message: "Road asset not found" });
      }

      // Get all moisture readings for this road asset
      const readings = await storage.getMoistureReadings(roadAssetId);

      if (readings.length === 0) {
        return res.status(404).json({ error: "No moisture readings found for this road asset" });
      }

      // Sort readings by moisture value in descending order
      const sortedReadings = [...readings].sort((a, b) => b.moistureValue - a.moistureValue);

      // Calculate the number of readings that represent the top 5%
      const topPercentageCount = Math.max(1, Math.ceil(sortedReadings.length * 0.05));

      // Get the top 5% readings
      const hotspots = sortedReadings.slice(0, topPercentageCount);

      // Check if we should include Street View images from Google Maps
      const includeStreetView = req.query.includeStreetView === 'true';

      // Array to hold the enhanced hotspots with street view data if requested
      const enhancedHotspots = await Promise.all(
        hotspots.map(async (hotspot) => {
          // Include Google Maps URL for each hotspot
          const googleMapsUrl = getGoogleMapsUrl(hotspot.latitude, hotspot.longitude);

          // If Street View images are requested and we have the API key
          let streetViewImages = [];
          if (includeStreetView && process.env.GOOGLE_MAPS_API_KEY) {
            try {
              streetViewImages = await getStreetViewImages(hotspot.latitude, hotspot.longitude);
            } catch (err) {
              console.error(`Error fetching Street View images for hotspot at (${hotspot.latitude}, ${hotspot.longitude}):`, err);
            }
          }

          return {
            ...hotspot,
            googleMapsUrl,
            streetViewImages: includeStreetView ? streetViewImages : undefined
          };
        })
      );

      res.json({
        roadAsset,
        hotspots: enhancedHotspots,
        totalReadings: readings.length,
        hotspotCount: hotspots.length,
        threshold: hotspots[hotspots.length - 1]?.moistureValue || 0
      });
    } catch (error) {
      console.error("Error getting moisture hotspots:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/moisture-readings/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid moisture reading ID" });
      }

      const reading = await storage.getMoistureReading(id);
      if (!reading) {
        return res.status(404).json({ message: "Moisture reading not found" });
      }

      res.json(reading);
    } catch (error) {
      console.error("Error getting moisture reading:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/moisture-readings", async (req: Request, res: Response) => {
    try {
      const validatedData = insertMoistureReadingSchema.parse(req.body);

      // Verify the road asset exists
      const roadAsset = await storage.getRoadAsset(validatedData.roadAssetId);
      if (!roadAsset) {
        return res.status(404).json({ message: "Road asset not found" });
      }

      const reading = await storage.createMoistureReading(validatedData);

      // Log the action
      await storage.createAuditLog({
        userId: 1,
        username: "admin",
        action: "Created moisture reading",
        details: `Created moisture reading for road asset ${roadAsset.name} (ID: ${roadAsset.id})`,
        ipAddress: req.ip,
        resourceType: "moisture_reading",
        resourceId: reading.id.toString(),
      });

      // Update the road asset's last moisture reading timestamp
      await storage.updateRoadAsset(roadAsset.id, {
        lastMoistureReading: reading.readingDate
      });

      res.status(201).json(reading);
    } catch (error) {
      console.error("Error creating moisture reading:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/moisture-readings/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid moisture reading ID" });
      }

      const existingReading = await storage.getMoistureReading(id);
      if (!existingReading) {
        return res.status(404).json({ message: "Moisture reading not found" });
      }

      const validatedData = insertMoistureReadingSchema.partial().parse(req.body);
      const updatedReading = await storage.updateMoistureReading(id, validatedData);

      // Log the action
      await storage.createAuditLog({
        userId: 1,
        username: "admin",
        action: "Updated moisture reading",
        details: `Updated moisture reading ID ${id} for road asset ID ${existingReading.roadAssetId}`,
        ipAddress: req.ip,
        resourceType: "moisture_reading",
        resourceId: id.toString(),
      });

      res.json(updatedReading);
    } catch (error) {
      console.error("Error updating moisture reading:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/moisture-readings/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid moisture reading ID" });
      }

      const existingReading = await storage.getMoistureReading(id);
      if (!existingReading) {
        return res.status(404).json({ message: "Moisture reading not found" });
      }

      await storage.deleteMoistureReading(id);

      // Log the action
      await storage.createAuditLog({
        userId: 1,
        username: "admin",
        action: "Deleted moisture reading",
        details: `Deleted moisture reading ID ${id} for road asset ID ${existingReading.roadAssetId}`,
        ipAddress: req.ip,
        resourceType: "moisture_reading",
        resourceId: id.toString(),
      });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting moisture reading:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/road-assets/:id/moisture-readings", async (req: Request, res: Response) => {
    try {
      const roadAssetId = parseInt(req.params.id);
      if (isNaN(roadAssetId)) {
        return res.status(400).json({ message: "Invalid road asset ID" });
      }

      const roadAsset = await storage.getRoadAsset(roadAssetId);
      if (!roadAsset) {
        return res.status(404).json({ message: "Road asset not found" });
      }

      await storage.deleteMoistureReadingsByRoadAsset(roadAssetId);

      // Log the action
      await storage.createAuditLog({
        userId: 1,
        username: "admin",
        action: "Deleted all moisture readings",
        details: `Deleted all moisture readings for road asset ${roadAsset.name} (ID: ${roadAsset.id})`,
        ipAddress: req.ip,
        resourceType: "road_asset",
        resourceId: roadAssetId.toString(),
      });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting moisture readings:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ===============================================================
  // ASSET INVENTORY SYSTEM ENDPOINTS
  // ===============================================================

  // Asset Types
  app.get("/api/asset-types", async (req: Request, res: Response) => {
    try {
      const assetTypes = await storage.getAssetTypes();
      res.json(assetTypes);
    } catch (error) {
      console.error("Error getting asset types:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/asset-types/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }

      const assetType = await storage.getAssetType(id);
      if (!assetType) {
        return res.status(404).json({ message: "Asset type not found" });
      }

      res.json(assetType);
    } catch (error) {
      console.error("Error getting asset type:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get roadway assets by asset type with tenant filtering
  app.get("/api/asset-types/:id/assets", async (req: Request, res: Response) => {
    try {
      const assetTypeId = parseInt(req.params.id);
      if (isNaN(assetTypeId)) {
        return res.status(400).json({ message: "Invalid asset type ID" });
      }

      // Check if tenant_id was provided as a query parameter
      const tenantId = req.query.tenant_id ? parseInt(req.query.tenant_id as string) : undefined;

      // If user is authenticated, use their current tenant if no tenant_id is provided
      const currentUser = req.user as User | undefined;
      const effectiveTenantId = tenantId || (currentUser?.currentTenantId || undefined);

      // Get assets of this type, filtered by tenant if applicable
      const assets = await storage.getRoadwayAssetsByType(assetTypeId, effectiveTenantId);

      // Log the action
      await storage.createAuditLog({
        userId: currentUser?.id || 1,
        username: currentUser?.username || "admin",
        action: "Viewed assets by type",
        details: `Viewed ${assets.length} assets of type ID ${assetTypeId}`,
        ipAddress: req.ip,
        resourceType: "asset_type",
        resourceId: assetTypeId.toString(),
      });

      res.json(assets);
    } catch (error) {
      console.error("Error getting assets by type:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Associate a roadway asset with a tenant
  app.post("/api/tenants/:tenantId/roadway-assets/:assetId", async (req: Request, res: Response) => {
    try {
      const tenantId = parseInt(req.params.tenantId);
      const assetId = parseInt(req.params.assetId);

      if (isNaN(tenantId) || isNaN(assetId)) {
        return res.status(400).json({ message: "Invalid tenant ID or asset ID" });
      }

      // Verify the tenant exists
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      // Verify the asset exists
      const asset = await storage.getRoadwayAsset(assetId);
      if (!asset) {
        return res.status(404).json({ message: "Roadway asset not found" });
      }

      // Associate the asset with the tenant
      const success = await storage.assignRoadwayAssetToTenant(tenantId, assetId);

      if (!success) {
        return res.status(500).json({ message: "Failed to associate asset with tenant" });
      }

      // Log the action
      const currentUser = req.user as User | undefined;
      await storage.createAuditLog({
        userId: currentUser?.id || 1,
        username: currentUser?.username || "admin",
        action: "Associated asset with tenant",
        details: `Associated roadway asset ID ${assetId} with tenant ID ${tenantId}`,
        ipAddress: req.ip,
        resourceType: "roadway_asset",
        resourceId: assetId.toString(),
      });

      res.status(201).json({ message: "Asset associated with tenant successfully" });
    } catch (error) {
      console.error("Error associating asset with tenant:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Remove a roadway asset from a tenant
  app.delete("/api/tenants/:tenantId/roadway-assets/:assetId", async (req: Request, res: Response) => {
    try {
      const tenantId = parseInt(req.params.tenantId);
      const assetId = parseInt(req.params.assetId);

      if (isNaN(tenantId) || isNaN(assetId)) {
        return res.status(400).json({ message: "Invalid tenant ID or asset ID" });
      }

      // Remove the asset from the tenant
      const success = await storage.removeRoadwayAssetFromTenant(tenantId, assetId);

      if (!success) {
        return res.status(404).json({ message: "Asset not associated with tenant or association could not be removed" });
      }

      // Log the action
      const currentUser = req.user as User | undefined;
      await storage.createAuditLog({
        userId: currentUser?.id || 1,
        username: currentUser?.username || "admin",
        action: "Removed asset from tenant",
        details: `Removed roadway asset ID ${assetId} from tenant ID ${tenantId}`,
        ipAddress: req.ip,
        resourceType: "roadway_asset",
        resourceId: assetId.toString(),
      });

      res.status(200).json({ message: "Asset removed from tenant successfully" });
    } catch (error) {
      console.error("Error removing asset from tenant:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get tenants associated with a roadway asset
  app.get("/api/roadway-assets/:assetId/tenants", async (req: Request, res: Response) => {
    try {
      const assetId = parseInt(req.params.assetId);

      if (isNaN(assetId)) {
        return res.status(400).json({ message: "Invalid asset ID" });
      }

      // Verify the asset exists
      const asset = await storage.getRoadwayAsset(assetId);
      if (!asset) {
        return res.status(404).json({ message: "Roadway asset not found" });
      }

      // We don't have a direct method to get tenants for a roadway asset,
      // so we'll query using SQL directly
      const tenants = await db.execute(sql`
        SELECT t.* 
        FROM tenants t
        JOIN tenant_roadway_assets tra ON t.id = tra.tenant_id
        WHERE tra.roadway_asset_id = ${assetId}
      `).then(result => result.rows as Tenant[]);

      res.json(tenants);
    } catch (error) {
      console.error("Error getting asset tenants:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/asset-types", async (req: Request, res: Response) => {
    try {
      const validatedData = insertAssetTypeSchema.parse(req.body);
      const assetType = await storage.createAssetType(validatedData);

      // Log the action
      await storage.createAuditLog({
        userId: 1,
        username: "admin",
        action: "Created asset type",
        details: `Created asset type: ${assetType.name}`,
        ipAddress: req.ip,
        resourceType: "asset_type",
        resourceId: assetType.id.toString(),
      });

      res.status(201).json(assetType);
    } catch (error) {
      console.error("Error creating asset type:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/asset-types/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }

      const existingAssetType = await storage.getAssetType(id);
      if (!existingAssetType) {
        return res.status(404).json({ message: "Asset type not found" });
      }

      const validatedData = insertAssetTypeSchema.partial().parse(req.body);
      const updatedAssetType = await storage.updateAssetType(id, validatedData);

      // Log the action
      await storage.createAuditLog({
        userId: 1,
        username: "admin",
        action: "Updated asset type",
        details: `Updated asset type: ${existingAssetType.name}`,
        ipAddress: req.ip,
        resourceType: "asset_type",
        resourceId: id.toString(),
      });

      res.json(updatedAssetType);
    } catch (error) {
      console.error("Error updating asset type:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Roadway Assets
  app.get("/api/roadway-assets", async (req: Request, res: Response) => {
    try {
      // Check if tenant_id was provided as a query parameter
      const tenantId = req.query.tenant_id ? parseInt(req.query.tenant_id as string) : undefined;

      // If user is authenticated, use their current tenant if no tenant_id is provided
      const currentUser = req.user as User | undefined;
      const effectiveTenantId = tenantId || (currentUser?.currentTenantId || undefined);

      const assets = await storage.getRoadwayAssets(effectiveTenantId);
      res.json(assets);
    } catch (error) {
      console.error("Error getting roadway assets:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/roadway-assets/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }

      // Check if tenant_id was provided as a query parameter
      const tenantId = req.query.tenant_id ? parseInt(req.query.tenant_id as string) : undefined;

      // If user is authenticated, use their current tenant if no tenant_id is provided
      const currentUser = req.user as User | undefined;
      const effectiveTenantId = tenantId || (currentUser?.currentTenantId || undefined);

      console.log(`Fetching roadway asset ID ${id}${effectiveTenantId ? ` for tenant ${effectiveTenantId}` : ''}`);
      const asset = await storage.getRoadwayAsset(id, effectiveTenantId);

      if (!asset) {
        return res.status(404).json({ message: "Roadway asset not found" });
      }

      res.json(asset);
    } catch (error) {
      console.error("Error getting roadway asset:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/roadway-assets", async (req: Request, res: Response) => {
    try {
      const validatedData = insertRoadwayAssetSchema.parse(req.body);

      // Check if the asset has coordinates in the geometry field or direct lat/lng fields
      let longitude: number | null = null;
      let latitude: number | null = null;

      // Extract coordinates from geometry if available
      if (validatedData.geometry && 
          typeof validatedData.geometry === 'object' &&
          'type' in validatedData.geometry &&
          validatedData.geometry.type === "Point" && 
          'coordinates' in validatedData.geometry &&
          Array.isArray(validatedData.geometry.coordinates) && 
          validatedData.geometry.coordinates.length === 2) {
        longitude = validatedData.geometry.coordinates[0];
        latitude = validatedData.geometry.coordinates[1];
      } 
      // If direct latitude/longitude fields are provided, use those
      else if (validatedData.latitude !== undefined && validatedData.longitude !== undefined) {
        longitude = validatedData.longitude;
        latitude = validatedData.latitude;
      }

      // If we have coordinates, find the closest road
      if (longitude !== null && latitude !== null) {
        // Get the current user and their tenant for filtering road assets
        const currentUser = req.user as User | undefined;
        const tenantId = currentUser?.currentTenantId;

        console.log(`Finding closest road for coordinates: ${longitude}, ${latitude}${tenantId ? ` in tenant ${tenantId}` : ''}`);
        const closestRoadId = await findClosestRoadAsset(longitude, latitude, 0.005, tenantId);

        if (closestRoadId) {
          console.log(`Found closest road with ID: ${closestRoadId}`);
          validatedData.roadAssetId = closestRoadId;
        } else {
          console.log('No close road found for the coordinates');
        }
      } else {
        console.log('No coordinates available to find closest road');
      }

      // Check for tenant_id in request body, or use current user's tenant if available
      const requestTenantId = req.body.tenant_id ? parseInt(req.body.tenant_id) : undefined;
      const currentUser = req.user as User | undefined;
      const effectiveTenantId = requestTenantId || currentUser?.currentTenantId;

      // If we have a tenant ID, add it to the asset data
      if (effectiveTenantId) {
        validatedData.tenantId = effectiveTenantId;
      }

      const asset = await storage.createRoadwayAsset(validatedData);

      // If we have a tenant ID, associate the asset with the tenant
      if (effectiveTenantId) {
        await storage.assignRoadwayAssetToTenant(effectiveTenantId, asset.id);
        console.log(`Associated new roadway asset ${asset.id} with tenant ${effectiveTenantId}`);
      }

      // Log the action
      await storage.createAuditLog({
        userId: currentUser?.id || 1,
        username: currentUser?.username || "admin",
        action: "Created roadway asset",
        details: `Created ${asset.assetId}: ${asset.name}${asset.roadAssetId ? ` (associated with road ID: ${asset.roadAssetId})` : ''}${effectiveTenantId ? ` (associated with tenant ID: ${effectiveTenantId})` : ''}`,
        ipAddress: req.ip,
        resourceType: "roadway_asset",
        resourceId: asset.id.toString(),
      });

      res.status(201).json(asset);
    } catch (error) {
      console.error("Error creating roadway asset:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/roadway-assets/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }

      // Get tenant context for filtering
      const currentUser = req.user as User | undefined;
      const effectiveTenantId = currentUser?.currentTenantId;

      // Get the asset with tenant filtering
      console.log(`Checking roadway asset ID ${id}${effectiveTenantId ? ` for tenant ${effectiveTenantId}` : ''}`);
      const existingAsset = await storage.getRoadwayAsset(id, effectiveTenantId);
      if (!existingAsset) {
        return res.status(404).json({ message: "Roadway asset not found" });
      }

      const validatedData = insertRoadwayAssetSchema.partial().parse(req.body);

      // Check if coordinates are being updated
      let longitude: number | null = null;
      let latitude: number | null = null;

      // Extract coordinates from geometry if available
      if (validatedData.geometry && 
          typeof validatedData.geometry === 'object' &&
          'type' in validatedData.geometry &&
          validatedData.geometry.type === "Point" && 
          'coordinates' in validatedData.geometry &&
          Array.isArray(validatedData.geometry.coordinates) && 
          validatedData.geometry.coordinates.length === 2) {
        longitude = validatedData.geometry.coordinates[0];
        latitude = validatedData.geometry.coordinates[1];
      } 
      // If direct latitude/longitude fields are provided, use those
      else if (validatedData.latitude !== undefined && validatedData.longitude !== undefined) {
        longitude = validatedData.longitude;
        latitude = validatedData.latitude;
      }

      // If coordinates were updated, find the closest road
      if (longitude !== null && latitude !== null) {
        // Use the already defined current user and tenant from earlier in this function
        console.log(`Finding closest road for updated asset ID ${id} at coordinates: ${longitude}, ${latitude}${effectiveTenantId ? ` in tenant ${effectiveTenantId}` : ''}`);
        const closestRoadId = await findClosestRoadAsset(longitude, latitude, 0.005, effectiveTenantId);

        if (closestRoadId) {
          console.log(`Found closest road with ID: ${closestRoadId} for asset ID: ${id}`);
          validatedData.roadAssetId = closestRoadId;
        } else {
          console.log('No close road found for the updated coordinates');
        }
      }

      // Check for tenant_id in request body, or use the current tenant context
      const requestTenantId = req.body.tenant_id ? parseInt(req.body.tenant_id) : undefined;
      // Use existing effectiveTenantId that was defined earlier in this function
      const updatedTenantId = requestTenantId || effectiveTenantId;

      // If we have a tenant ID and it's different from the existing one, update it
      if (updatedTenantId !== undefined && updatedTenantId !== existingAsset.tenantId) {
        validatedData.tenantId = updatedTenantId;

        // Update the tenant association
        if (existingAsset.tenantId) {
          // Remove from old tenant
          await storage.removeRoadwayAssetFromTenant(existingAsset.tenantId, id);
        }

        // Add to new tenant
        await storage.assignRoadwayAssetToTenant(updatedTenantId, id);
        console.log(`Updated roadway asset ${id} tenant association to ${updatedTenantId}`);
      }

      const updatedAsset = await storage.updateRoadwayAsset(id, validatedData);

      // Log the action
      await storage.createAuditLog({
        userId: currentUser?.id || 1,
        username: currentUser?.username || "admin",
        action: "Updated roadway asset",
        details: `Updated ${existingAsset.assetId}: ${existingAsset.name}${updatedAsset?.roadAssetId ? ` (associated with road ID: ${updatedAsset.roadAssetId})` : ''}${updatedTenantId ? ` (associated with tenant ID: ${updatedTenantId})` : ''}`,
        ipAddress: req.ip,
        resourceType: "roadway_asset",
        resourceId: id.toString(),
      });

      res.json(updatedAsset);
    } catch (error) {
      console.error("Error updating roadway asset:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/roadway-assets/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }

      // Get tenant context for filtering
      const currentUser = req.user as User | undefined;
      const effectiveTenantId = currentUser?.currentTenantId;

      // Get the asset with tenant filtering
      console.log(`Checking roadway asset ID ${id}${effectiveTenantId ? ` for tenant ${effectiveTenantId}` : ''}`);
      const existingAsset = await storage.getRoadwayAsset(id, effectiveTenantId);
      if (!existingAsset) {
        return res.status(404).json({ message: "Roadway asset not found" });
      }

      await storage.deleteRoadwayAsset(id);

      // Log the action
      await storage.createAuditLog({
        userId: 1,
        username: "admin",
        action: "Deleted roadway asset",
        details: `Deleted ${existingAsset.assetId}: ${existingAsset.name}`,
        ipAddress: req.ip,
        resourceType: "roadway_asset",
        resourceId: id.toString(),
      });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting roadway asset:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Asset Inspections
  app.get("/api/asset-inspections", async (req: Request, res: Response) => {
    try {
      const inspections = await storage.getAssetInspections();
      res.json(inspections);
    } catch (error) {
      console.error("Error getting asset inspections:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/roadway-assets/:assetId/inspections", async (req: Request, res: Response) => {
    try {
      const assetId = parseInt(req.params.assetId);
      if (isNaN(assetId)) {
        return res.status(400).json({ message: "Invalid asset ID" });
      }

      const inspections = await storage.getAssetInspectionsByAssetId(assetId);
      res.json(inspections);
    } catch (error) {
      console.error("Error getting inspections for asset:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/asset-inspections", async (req: Request, res: Response) => {
    try {
      const validatedData = insertAssetInspectionSchema.parse(req.body);
      const inspection = await storage.createAssetInspection(validatedData);

      // Update the asset's condition and last inspection date
      const asset = await storage.getRoadwayAsset(inspection.roadwayAssetId);
      if (asset) {
        await storage.updateRoadwayAsset(asset.id, {
          condition: inspection.condition,
          lastInspection: inspection.inspectionDate,
        });
      }

      // Log the action
      await storage.createAuditLog({
        userId: 1,
        username: "admin",
        action: "Created asset inspection",
        details: `Inspected asset ID ${inspection.roadwayAssetId}, condition: ${inspection.condition}`,
        ipAddress: req.ip,
        resourceType: "asset_inspection",
        resourceId: inspection.id.toString(),
      });

      res.status(201).json(inspection);
    } catch (error) {
      console.error("Error creating asset inspection:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Asset Maintenance Records
  app.get("/api/asset-maintenance-records", async (req: Request, res: Response) => {
    try {
      const records = await storage.getAssetMaintenanceRecords();
      res.json(records);
    } catch (error) {
      console.error("Error getting asset maintenance records:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/roadway-assets/:assetId/maintenance", async (req: Request, res: Response) => {
    try {
      const assetId = parseInt(req.params.assetId);
      if (isNaN(assetId)) {
        return res.status(400).json({ message: "Invalid asset ID" });
      }

      const records = await storage.getAssetMaintenanceRecordsByAssetId(assetId);
      res.json(records);
    } catch (error) {
      console.error("Error getting maintenance records for asset:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/asset-maintenance-records", async (req: Request, res: Response) => {
    try {
      const validatedData = insertAssetMaintenanceRecordSchema.parse(req.body);
      const record = await storage.createAssetMaintenanceRecord(validatedData);

      // Update the asset's condition and last maintenance date if afterCondition is provided
      if (record.afterCondition) {
        const asset = await storage.getRoadwayAsset(record.roadwayAssetId);
        if (asset) {
          await storage.updateRoadwayAsset(asset.id, {
            condition: record.afterCondition,
            lastMaintenanceDate: record.maintenanceDate,
          });
        }
      }

      // Log the action
      await storage.createAuditLog({
        userId: 1,
        username: "admin",
        action: "Created asset maintenance record",
        details: `Maintenance performed on asset ID ${record.roadwayAssetId}`,
        ipAddress: req.ip,
        resourceType: "asset_maintenance_record",
        resourceId: record.id.toString(),
      });

      res.status(201).json(record);
    } catch (error) {
      console.error("Error creating asset maintenance record:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Import/Export Endpoints
  app.post("/api/import/roadway-assets", async (req: Request, res: Response) => {
    try {
      // Expect an array of assets in the request body
      const assets = z.array(insertRoadwayAssetSchema).parse(req.body);
      const results = [];

      for (const asset of assets) {
        try {
          // Check if asset has coordinates to find the closest road
          let longitude: number | null = null;
          let latitude: number | null = null;

          // Extract coordinates from geometry if available
          if (asset.geometry && 
              typeof asset.geometry === 'object' &&
              'type' in asset.geometry &&
              asset.geometry.type === "Point" && 
              'coordinates' in asset.geometry &&
              Array.isArray(asset.geometry.coordinates) && 
              asset.geometry.coordinates.length === 2) {
            longitude = asset.geometry.coordinates[0];
            latitude = asset.geometry.coordinates[1];
          } 
          // If direct latitude/longitude fields are provided, use those
          else if (asset.latitude !== undefined && asset.longitude !== undefined) {
            longitude = asset.longitude;
            latitude = asset.latitude;
          }

          // If we have coordinates, find the closest road
          if (longitude !== null && latitude !== null) {
            // Get the current user and their tenant for filtering road assets
            const currentUser = req.user as User | undefined;
            const tenantId = currentUser?.currentTenantId;

            console.log(`Finding closest road for imported asset: ${asset.assetId} at coordinates: ${longitude}, ${latitude}${tenantId ? ` in tenant ${tenantId}` : ''}`);
            const closestRoadId = await findClosestRoadAsset(longitude, latitude, 0.005, tenantId);

            if (closestRoadId) {
              console.log(`Found closest road with ID: ${closestRoadId} for imported asset: ${asset.assetId}`);
              asset.roadAssetId = closestRoadId;
            }
          }

          // Check for tenant_id in request body or use current user's tenant
          const requestTenantId = req.body.tenant_id ? parseInt(req.body.tenant_id) : undefined;
          const currentUser = req.user as User | undefined;
          const effectiveTenantId = requestTenantId || currentUser?.currentTenantId;

          // If we have a tenant ID, add it to the asset data
          if (effectiveTenantId) {
            asset.tenantId = effectiveTenantId;
          }

          const createdAsset = await storage.createRoadwayAsset(asset);

          // If we have a tenant ID, associate the asset with the tenant
          if (effectiveTenantId) {
            await storage.assignRoadwayAssetToTenant(effectiveTenantId, createdAsset.id);
            console.log(`Associated imported roadway asset ${createdAsset.id} with tenant ${effectiveTenantId}`);
          }

          results.push({
            success: true,
            assetId: createdAsset.assetId,
            id: createdAsset.id,
            roadAssetId: createdAsset.roadAssetId,
            tenantId: effectiveTenantId
          });
        } catch (err) {
          results.push({
            success: false,
            assetId: asset.assetId,
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }

      // Log the action
      await storage.createAuditLog({
        userId: 1,
        username: "admin",
        action: "Imported roadway assets",
        details: `Imported ${results.filter(r => r.success).length} assets. Failed: ${results.filter(r => !r.success).length}`,
        ipAddress: req.ip,
        resourceType: "roadway_asset",
        resourceId: "batch-import",
      });

      res.status(200).json({
        totalProcessed: assets.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      });
    } catch (error) {
      console.error("Error importing roadway assets:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/export/roadway-assets", async (req: Request, res: Response) => {
    try {
      let assets;

      // Get tenant context
      const currentUser = req.user as User | undefined;
      const tenantId = req.query.tenant_id ? 
        parseInt(req.query.tenant_id as string) : 
        (currentUser?.currentTenantId || undefined);

      // Filter by asset type if specified
      if (req.query.assetTypeId) {
        const assetTypeId = parseInt(req.query.assetTypeId as string);
        if (isNaN(assetTypeId)) {
          return res.status(400).json({ message: "Invalid asset type ID" });
        }
        // Apply tenant filtering with type filtering
        assets = await storage.getRoadwayAssetsByType(assetTypeId, tenantId);
      } else {
        // Use tenant filtering when getting all assets
        assets = await storage.getRoadwayAssets(tenantId);
      }

      // Log the action
      await storage.createAuditLog({
        userId: 1,
        username: "admin",
        action: "Exported roadway assets",
        details: `Exported ${assets.length} assets`,
        ipAddress: req.ip,
        resourceType: "roadway_asset",
        resourceId: "batch-export",
      });

      res.json(assets);
    } catch (error) {
      console.error("Error exporting roadway assets:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // User Management endpoints
  app.get("/api/users", async (req: Request, res: Response) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }

      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(user);
    } catch (error) {
      console.error(`Error fetching user with ID ${req.params.id}:`, error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.post("/api/users", async (req: Request, res: Response) => {
    try {
      const userData = insertUserSchema.safeParse(req.body);

      if (!userData.success) {
        return res.status(400).json({ error: "Invalid user data", details: userData.error.format() });
      }

      // Generate a random username from email if not provided
      let username = userData.data.username;
      if (!username && userData.data.email) {
        const emailPrefix = userData.data.email.split('@')[0];
        const randomSuffix = crypto.randomBytes(4).toString('hex');
        username = `${emailPrefix}_${randomSuffix}`;
      }

      // Check if username already exists using direct SQL
      if (username) {
        const existingUserQuery = `
          SELECT * FROM users WHERE username = $1
        `;
        const existingUserResult = await pool.query(existingUserQuery, [username]);

        if (existingUserResult.rows.length > 0) {
          return res.status(409).json({ error: "Username already exists" });
        }
      }

      // Check if email already exists (if provided)
      if (userData.data.email) {
        const existingEmailQuery = `
          SELECT * FROM users WHERE email = $1
        `;
        const existingEmailResult = await pool.query(existingEmailQuery, [userData.data.email]);

        if (existingEmailResult.rows.length > 0) {
          return res.status(409).json({ error: "Email address already exists" });
        }
      }

      // For new passwordless users, generate a random temporary password
      // It will be never used since the user will log in with magic links
      let password = userData.data.password;
      if (!password && userData.data.email) {
        password = crypto.randomBytes(16).toString('hex');
      }

      // Insert the user using direct SQL
      const createUserQuery = `
        INSERT INTO users (
          username, 
          password, 
          full_name, 
          role, 
          email, 
          is_system_admin
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, username, full_name, role, email, is_system_admin AS "isSystemAdmin"
      `;

      const userResult = await pool.query(createUserQuery, [
        username,
        password,
        userData.data.fullName,
        userData.data.role,
        userData.data.email,
        userData.data.isSystemAdmin || false
      ]);

      const user = userResult.rows[0];

      // If email is provided, try to send a welcome email with magic link
      if (userData.data.email) {
        try {
          await sendMagicLinkEmail(userData.data.email);
          console.log(`Magic link email sent to new user: ${userData.data.email}`);
        } catch (emailError) {
          console.error("Failed to send welcome email to new user:", emailError);
          // We don't return an error here, user creation was successful
        }
      }

      res.status(201).json(user);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.put("/api/users/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }

      // Allow partial updates without requiring all fields
      const userUpdateSchema = insertUserSchema.partial();
      const userData = userUpdateSchema.safeParse(req.body);

      if (!userData.success) {
        return res.status(400).json({ error: "Invalid user data", details: userData.error.format() });
      }

      // If username is being changed, check that it doesn't conflict with existing users
      if (userData.data.username) {
        const existingUser = await storage.getUserByUsername(userData.data.username);
        if (existingUser && existingUser.id !== id) {
          return res.status(409).json({ error: "Username already exists" });
        }
      }

      const updatedUser = await storage.updateUser(id, userData.data);
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error(`Error updating user with ID ${req.params.id}:`, error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }

      const success = await storage.deleteUser(id);
      if (!success) {
        return res.status(404).json({ error: "User not found" });
      }

      res.status(204).end();
    } catch (error) {
      console.error(`Error deleting user with ID ${req.params.id}:`, error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // User-Tenant relationship management
  app.get("/api/user-tenants", async (req: Request, res: Response) => {
    try {
      const userTenants = await storage.getAllUserTenants();
      res.json(userTenants);
    } catch (error) {
      console.error("Error fetching user-tenant relationships:", error);
      res.status(500).json({ error: "Failed to fetch user-tenant relationships" });
    }
  });

  app.post("/api/user-tenants", async (req: Request, res: Response) => {
    try {
      const userTenantData = insertUserTenantSchema.safeParse(req.body);

      if (!userTenantData.success) {
        return res.status(400).json({ error: "Invalid user-tenant data", details: userTenantData.error.format() });
      }

      // Check if the user and tenant exist
      const user = await storage.getUser(userTenantData.data.userId);
      const tenant = await storage.getTenant(userTenantData.data.tenantId);

      if (!user || !tenant) {
        return res.status(404).json({ error: "User or tenant not found" });
      }

      const userTenant = await storage.createUserTenant(userTenantData.data);
      res.status(201).json(userTenant);
    } catch (error) {
      console.error("Error creating user-tenant relationship:", error);
      res.status(500).json({ error: "Failed to create user-tenant relationship" });
    }
  });

  app.put("/api/user-tenants/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid user-tenant ID" });
      }

      // Allow partial updates of role and isAdmin
      const updateSchema = z.object({
        role: z.string().optional(),
        isAdmin: z.boolean().optional(),
      });

      const updateData = updateSchema.safeParse(req.body);

      if (!updateData.success) {
        return res.status(400).json({ error: "Invalid update data", details: updateData.error.format() });
      }

      const updatedUserTenant = await storage.updateUserTenant(id, updateData.data);
      if (!updatedUserTenant) {
        return res.status(404).json({ error: "User-tenant relationship not found" });
      }

      res.json(updatedUserTenant);
    } catch (error) {
      console.error(`Error updating user-tenant relationship with ID ${req.params.id}:`, error);
      res.status(500).json({ error: "Failed to update user-tenant relationship" });
    }
  });

  app.delete("/api/user-tenants/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid user-tenant ID" });
      }

      const success = await storage.deleteUserTenant(id);
      if (!success) {
        return res.status(404).json({ error: "User-tenant relationship not found" });
      }

      res.status(204).end();
    } catch (error) {
      console.error(`Error deleting user-tenant relationship with ID ${req.params.id}:`, error);
      res.status(500).json({ error: "Failed to delete user-tenant relationship" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}