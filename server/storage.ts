import {
  users, User, InsertUser,
  tenants, Tenant, InsertTenant,
  userTenants,
  tenantRoadAssets,
  tenantRoadwayAssets,
  roadAssets, RoadAsset, InsertRoadAsset,
  maintenanceTypes, MaintenanceType, InsertMaintenanceType,
  maintenanceProjects, MaintenanceProject, InsertMaintenanceProject,
  policies, Policy, InsertPolicy,
  budgetAllocations, BudgetAllocation, InsertBudgetAllocation,
  auditLogs, AuditLog, InsertAuditLog,
  moistureReadings, MoistureReading, InsertMoistureReading,
  assetTypes, AssetType, InsertAssetType,
  roadwayAssets, RoadwayAsset, InsertRoadwayAsset,
  assetInspections, AssetInspection, InsertAssetInspection,
  assetMaintenanceRecords, AssetMaintenanceRecord, InsertAssetMaintenanceRecord
} from "@shared/schema";
import { db, pool } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // Tenant operations
  getTenants(): Promise<Tenant[]>;
  getTenant(id: number): Promise<Tenant | undefined>;
  getTenantByCode(code: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: number, tenant: Partial<InsertTenant>): Promise<Tenant | undefined>;
  deleteTenant(id: number): Promise<boolean>;
  
  // User-Tenant operations
  getUserTenants(userId: number): Promise<Tenant[]>;
  addUserToTenant(userId: number, tenantId: number, role: string, isAdmin: boolean): Promise<boolean>;
  removeUserFromTenant(userId: number, tenantId: number): Promise<boolean>;
  updateUserTenantRole(userId: number, tenantId: number, role: string, isAdmin: boolean): Promise<boolean>;
  setUserCurrentTenant(userId: number, tenantId: number | null): Promise<User | undefined>;
  getAllUserTenants(): Promise<UserTenant[]>;
  createUserTenant(userTenant: { userId: number, tenantId: number, role: string, isAdmin: boolean }): Promise<UserTenant>;
  updateUserTenant(id: number, userTenant: Partial<{ role: string, isAdmin: boolean }>): Promise<UserTenant | undefined>;
  deleteUserTenant(id: number): Promise<boolean>;
  
  // Tenant-Asset operations
  assignRoadAssetToTenant(tenantId: number, roadAssetId: number): Promise<boolean>;
  removeRoadAssetFromTenant(tenantId: number, roadAssetId: number): Promise<boolean>;
  getTenantRoadAssets(tenantId: number): Promise<RoadAsset[]>;
  assignRoadwayAssetToTenant(tenantId: number, roadwayAssetId: number): Promise<boolean>;
  removeRoadwayAssetFromTenant(tenantId: number, roadwayAssetId: number): Promise<boolean>;
  getTenantRoadwayAssets(tenantId: number): Promise<RoadwayAsset[]>;
  
  // User operations
  getUsers(): Promise<User[]>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  
  // Road asset operations
  getRoadAssets(): Promise<RoadAsset[]>;
  getRoadAssetsByTenants(tenantIds: number[]): Promise<RoadAsset[]>;
  getRoadAsset(id: number): Promise<RoadAsset | undefined>;
  getRoadAssetByAssetId(assetId: string): Promise<RoadAsset | undefined>;
  createRoadAsset(asset: InsertRoadAsset): Promise<RoadAsset>;
  updateRoadAsset(id: number, asset: Partial<InsertRoadAsset>): Promise<RoadAsset | undefined>;
  deleteRoadAsset(id: number): Promise<boolean>;
  
  // Maintenance type operations
  getMaintenanceTypes(): Promise<MaintenanceType[]>;
  getMaintenanceType(id: number): Promise<MaintenanceType | undefined>;
  createMaintenanceType(type: InsertMaintenanceType): Promise<MaintenanceType>;
  updateMaintenanceType(id: number, type: Partial<InsertMaintenanceType>): Promise<MaintenanceType | undefined>;
  deleteMaintenanceType(id: number): Promise<boolean>;
  
  // Maintenance project operations
  getMaintenanceProjects(): Promise<MaintenanceProject[]>;
  getMaintenanceProjectsByTenants(tenantIds: number[]): Promise<MaintenanceProject[]>;
  getMaintenanceProject(id: number): Promise<MaintenanceProject | undefined>;
  createMaintenanceProject(project: InsertMaintenanceProject): Promise<MaintenanceProject>;
  updateMaintenanceProject(id: number, project: Partial<InsertMaintenanceProject>): Promise<MaintenanceProject | undefined>;
  deleteMaintenanceProject(id: number): Promise<boolean>;
  
  // Policy operations
  getPolicies(): Promise<Policy[]>;
  getPolicy(id: number): Promise<Policy | undefined>;
  createPolicy(policy: InsertPolicy): Promise<Policy>;
  updatePolicy(id: number, policy: Partial<InsertPolicy>): Promise<Policy | undefined>;
  deletePolicy(id: number): Promise<boolean>;
  
  // Budget allocation operations
  getBudgetAllocations(): Promise<BudgetAllocation[]>;
  getBudgetAllocationsByTenants(tenantIds: number[]): Promise<BudgetAllocation[]>;
  getBudgetAllocation(id: number): Promise<BudgetAllocation | undefined>;
  getActiveBudgetAllocation(): Promise<BudgetAllocation | undefined>;
  createBudgetAllocation(budget: InsertBudgetAllocation): Promise<BudgetAllocation>;
  updateBudgetAllocation(id: number, budget: Partial<InsertBudgetAllocation>): Promise<BudgetAllocation | undefined>;
  setBudgetAllocationActive(id: number): Promise<BudgetAllocation | undefined>;
  deleteBudgetAllocation(id: number): Promise<boolean>;
  
  // Moisture reading operations
  getMoistureReadings(roadAssetId: number): Promise<MoistureReading[]>;
  getLatestMoistureReadings(): Promise<Record<string, MoistureReading>>;
  getMoistureReading(id: number): Promise<MoistureReading | undefined>;
  createMoistureReading(reading: InsertMoistureReading): Promise<MoistureReading>;
  updateMoistureReading(id: number, reading: Partial<InsertMoistureReading>): Promise<MoistureReading | undefined>;
  deleteMoistureReading(id: number): Promise<boolean>;
  deleteMoistureReadingsByRoadAsset(roadAssetId: number): Promise<boolean>;
  
  // Audit log operations
  getAuditLogs(): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  
  // Asset Types operations
  getAssetTypes(): Promise<AssetType[]>;
  getAssetType(id: number): Promise<AssetType | undefined>;
  createAssetType(type: InsertAssetType): Promise<AssetType>;
  updateAssetType(id: number, type: Partial<InsertAssetType>): Promise<AssetType | undefined>;
  deleteAssetType(id: number): Promise<boolean>;
  
  // Roadway Assets operations
  getRoadwayAssets(tenantId?: number): Promise<RoadwayAsset[]>;
  getRoadwayAssetsByType(assetTypeId: number, tenantId?: number): Promise<RoadwayAsset[]>;
  getRoadwayAsset(id: number): Promise<RoadwayAsset | undefined>;
  createRoadwayAsset(asset: InsertRoadwayAsset): Promise<RoadwayAsset>;
  updateRoadwayAsset(id: number, asset: Partial<InsertRoadwayAsset>): Promise<RoadwayAsset | undefined>;
  deleteRoadwayAsset(id: number): Promise<boolean>;
  
  // Asset Inspections operations
  getAssetInspections(): Promise<AssetInspection[]>;
  getAssetInspectionsByAssetId(roadwayAssetId: number): Promise<AssetInspection[]>;
  getAssetInspection(id: number): Promise<AssetInspection | undefined>;
  createAssetInspection(inspection: InsertAssetInspection): Promise<AssetInspection>;
  updateAssetInspection(id: number, inspection: Partial<InsertAssetInspection>): Promise<AssetInspection | undefined>;
  deleteAssetInspection(id: number): Promise<boolean>;
  
  // Asset Maintenance Records operations
  getAssetMaintenanceRecords(): Promise<AssetMaintenanceRecord[]>;
  getAssetMaintenanceRecordsByAssetId(roadwayAssetId: number): Promise<AssetMaintenanceRecord[]>;
  getAssetMaintenanceRecord(id: number): Promise<AssetMaintenanceRecord | undefined>;
  createAssetMaintenanceRecord(record: InsertAssetMaintenanceRecord): Promise<AssetMaintenanceRecord>;
  updateAssetMaintenanceRecord(id: number, record: Partial<InsertAssetMaintenanceRecord>): Promise<AssetMaintenanceRecord | undefined>;
  deleteAssetMaintenanceRecord(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private tenants: Map<number, Tenant>;
  private userTenants: Map<string, { userId: number, tenantId: number, role: string, isAdmin: boolean }>;
  private tenantRoadAssets: Map<string, { tenantId: number, roadAssetId: number }>;
  private tenantRoadwayAssets: Map<string, { tenantId: number, roadwayAssetId: number }>;
  private roadAssets: Map<number, RoadAsset>;
  private maintenanceTypes: Map<number, MaintenanceType>;
  private maintenanceProjects: Map<number, MaintenanceProject>;
  private policies: Map<number, Policy>;
  private budgetAllocations: Map<number, BudgetAllocation>;
  private auditLogs: Map<number, AuditLog>;
  private moistureReadings: Map<number, MoistureReading>;
  private assetTypes: Map<number, AssetType>;
  private roadwayAssets: Map<number, RoadwayAsset>;
  private assetInspections: Map<number, AssetInspection>;
  private assetMaintenanceRecords: Map<number, AssetMaintenanceRecord>;
  
  private userIdCounter: number;
  private tenantIdCounter: number;
  private roadAssetIdCounter: number;
  private maintenanceTypeIdCounter: number;
  private maintenanceProjectIdCounter: number;
  private policyIdCounter: number;
  private budgetAllocationIdCounter: number;
  private auditLogIdCounter: number;
  private moistureReadingIdCounter: number;
  private assetTypeIdCounter: number;
  private roadwayAssetIdCounter: number;
  private assetInspectionIdCounter: number;
  private assetMaintenanceRecordIdCounter: number;
  
  constructor() {
    this.users = new Map();
    this.tenants = new Map();
    this.userTenants = new Map();
    this.tenantRoadAssets = new Map();
    this.tenantRoadwayAssets = new Map();
    this.roadAssets = new Map();
    this.maintenanceTypes = new Map();
    this.maintenanceProjects = new Map();
    this.policies = new Map();
    this.budgetAllocations = new Map();
    this.auditLogs = new Map();
    this.moistureReadings = new Map();
    this.assetTypes = new Map();
    this.roadwayAssets = new Map();
    this.assetInspections = new Map();
    this.assetMaintenanceRecords = new Map();
    
    this.userIdCounter = 1;
    this.tenantIdCounter = 1;
    this.roadAssetIdCounter = 1;
    this.maintenanceTypeIdCounter = 1;
    this.maintenanceProjectIdCounter = 1;
    this.policyIdCounter = 1;
    this.budgetAllocationIdCounter = 1;
    this.auditLogIdCounter = 1;
    this.moistureReadingIdCounter = 1;
    this.assetTypeIdCounter = 1;
    this.roadwayAssetIdCounter = 1;
    this.assetInspectionIdCounter = 1;
    this.assetMaintenanceRecordIdCounter = 1;
    
    this.initializeData();
  }
  
  // Initialize with some default data
  private initializeData() {
    // Create default tenants
    const mechanicsville = this.createTenant({
      name: "Mechanicsville",
      code: "MECH",
      description: "Town of Mechanicsville, VA",
      contactEmail: "info@mechanicsville.gov",
      contactPhone: "(804) 555-1212",
      address: "123 Main Street, Mechanicsville, VA 23111",
      active: true
    });
    
    const ashland = this.createTenant({
      name: "Ashland",
      code: "ASHL",
      description: "Town of Ashland, VA",
      contactEmail: "info@ashland.gov",
      contactPhone: "(804) 555-2323",
      address: "456 Center Street, Ashland, VA 23005",
      active: true
    });
    
    // Create a default user
    const admin = this.createUser({
      username: "admin",
      password: "admin123", // In a real app, this would be hashed
      fullName: "John Rodriguez",
      role: "Road Manager",
      isSystemAdmin: true,
      currentTenantId: mechanicsville.id
    });
    
    // Add user to tenants
    this.addUserToTenant(admin.id, mechanicsville.id, "Road Manager", true);
    this.addUserToTenant(admin.id, ashland.id, "Road Manager", true);
    
    // Create default maintenance types
    this.createMaintenanceType({
      name: "Crack Sealing",
      description: "Sealing cracks with asphalt emulsion to prevent water intrusion",
      lifespanExtension: 2,
      conditionImprovement: 5,
      costPerMile: 3000,
      applicableMinCondition: 60,
      applicableMaxCondition: 100
    });
    
    this.createMaintenanceType({
      name: "Surface Treatment",
      description: "Application of a thin surface treatment to preserve the pavement",
      lifespanExtension: 5,
      conditionImprovement: 10,
      costPerMile: 30000,
      applicableMinCondition: 50,
      applicableMaxCondition: 80
    });
    
    this.createMaintenanceType({
      name: "Mill & Overlay",
      description: "Milling the existing surface and applying a new layer of asphalt",
      lifespanExtension: 10,
      conditionImprovement: 25,
      costPerMile: 135000,
      applicableMinCondition: 30,
      applicableMaxCondition: 60
    });
    
    this.createMaintenanceType({
      name: "Reconstruction",
      description: "Complete removal and replacement of the road structure",
      lifespanExtension: 20,
      conditionImprovement: 100,
      costPerMile: 500000,
      applicableMinCondition: 0,
      applicableMaxCondition: 40
    });
    
    // Create default budget allocation
    this.createBudgetAllocation({
      name: "FY 2023 Budget",
      description: "Fiscal Year 2023 Road Asset Budget",
      fiscalYear: 2023,
      totalBudget: 24800000,
      preventiveMaintenance: 8200000,
      minorRehabilitation: 6500000,
      majorRehabilitation: 5300000,
      reconstruction: 4800000,
      createdBy: 1,
      active: "true"
    });
    
    // Create some sample road assets
    const now = new Date();
    
    // Main Street - Good condition (matches actual main road)
    this.createRoadAsset({
      assetId: "RS-1024",
      name: "Main Street",
      location: "Downtown",
      length: 2.4,
      width: 24,
      surfaceType: "Asphalt",
      condition: 87,
      lastInspection: now,
      nextInspection: new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()),
      geometry: {
        type: "LineString",
        coordinates: [
          [-73.9877, 40.7484], // NYC - Broadway/Times Square start
          [-73.9871, 40.7519],
          [-73.9866, 40.7548],
          [-73.9860, 40.7577],
          [-73.9855, 40.7604] // Broadway heading north
        ]
      },
    });
    
    // Oak Avenue - Fair condition (follows an actual street)
    this.createRoadAsset({
      assetId: "RS-0872",
      name: "7th Avenue",
      location: "Midtown",
      length: 1.2,
      width: 22,
      surfaceType: "Asphalt",
      condition: 65,
      lastInspection: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 4),
      nextInspection: new Date(now.getFullYear() + 1, now.getMonth(), now.getDate() - 4),
      geometry: {
        type: "LineString",
        coordinates: [
          [-73.9819, 40.7489], // 7th Ave at 42nd
          [-73.9804, 40.7521], // 7th Ave at 45th
          [-73.9789, 40.7554], // 7th Ave at 48th
          [-73.9778, 40.7580], // 7th Ave at 51st
          [-73.9761, 40.7618]  // 7th Ave at 55th
        ]
      },
    });
    
    // River Road - Poor condition (follows East River Drive)
    this.createRoadAsset({
      assetId: "RS-1543",
      name: "FDR Drive",
      location: "East Side",
      length: 2.6,
      width: 20,
      surfaceType: "Asphalt",
      condition: 48,
      lastInspection: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7),
      nextInspection: new Date(now.getFullYear() + 1, now.getMonth(), now.getDate() - 7),
      geometry: {
        type: "LineString",
        coordinates: [
          [-73.9738, 40.7560], // FDR at 53rd
          [-73.9708, 40.7590], // FDR heading north
          [-73.9675, 40.7624], // FDR continuing
          [-73.9654, 40.7648], // FDR continuing
          [-73.9621, 40.7683], // FDR at 63rd
          [-73.9595, 40.7708]  // FDR at 67th
        ]
      },
    });
    
    // Commerce Way - Critical condition (follows actual avenue)
    this.createRoadAsset({
      assetId: "RS-0932",
      name: "Lexington Avenue",
      location: "East Midtown",
      length: 3.1,
      width: 26,
      surfaceType: "Concrete",
      condition: 34,
      lastInspection: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 12),
      nextInspection: new Date(now.getFullYear() + 1, now.getMonth(), now.getDate() - 12),
      geometry: {
        type: "LineString",
        coordinates: [
          [-73.9730, 40.7523], // Lex at 45th
          [-73.9711, 40.7565], // Lex at 50th
          [-73.9692, 40.7608], // Lex at 55th
          [-73.9672, 40.7650], // Lex at 60th
          [-73.9653, 40.7693], // Lex at 65th
          [-73.9634, 40.7735]  // Lex at 70th
        ]
      },
    });
    
    // Highland Drive - Good condition (Central Park East Drive)
    this.createRoadAsset({
      assetId: "RS-1128",
      name: "Central Park East Drive",
      location: "Upper East Side",
      length: 2.4,
      width: 24,
      surfaceType: "Asphalt",
      condition: 82,
      lastInspection: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 17),
      nextInspection: new Date(now.getFullYear() + 1, now.getMonth(), now.getDate() - 17),
      geometry: {
        type: "LineString",
        coordinates: [
          [-73.9645, 40.7730], // East Drive at 70th
          [-73.9654, 40.7757], // East Drive curve
          [-73.9663, 40.7782], // East Drive at 75th
          [-73.9668, 40.7809], // East Drive at 80th
          [-73.9664, 40.7835]  // East Drive at 85th
        ]
      },
    });
    
    // Maple Boulevard - Fair condition (follows Central Park loop)
    this.createRoadAsset({
      assetId: "RS-3392",
      name: "Central Park Loop",
      location: "Central Park",
      length: 1.5,
      width: 26,
      surfaceType: "Asphalt",
      condition: 72,
      lastInspection: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 8),
      nextInspection: new Date(now.getFullYear() + 1, now.getMonth(), now.getDate() - 8),
      geometry: {
        type: "LineString",
        coordinates: [
          [-73.9725, 40.7704], // CP loop west side
          [-73.9710, 40.7730], // CP loop curve
          [-73.9686, 40.7754], // CP loop north curve
          [-73.9656, 40.7758], // CP loop east curve
          [-73.9645, 40.7730], // CP loop south curve
          [-73.9659, 40.7706], // CP loop southwest
          [-73.9685, 40.7690], // CP loop south
          [-73.9725, 40.7704]  // CP loop completing circle
        ]
      },
    });
    
    // Create some maintenance projects
    this.createMaintenanceProject({
      projectId: "PR-2023-042",
      roadAssetId: 3,
      maintenanceTypeId: 3,
      status: "Planned",
      scheduledDate: new Date(now.getFullYear(), now.getMonth() + 1, 15),
      cost: 351000,
      notes: "Mill & Overlay for River Road",
      updatedBy: 1
    });
    
    // Create some policies
    this.createPolicy({
      name: "Preventive Maintenance for Asphalt",
      description: "Apply preventive maintenance for asphalt roads",
      surfaceType: "Asphalt",
      conditionThreshold: 75,
      maintenanceTypeId: 1,
      priority: 1,
      active: "true"
    });
    
    this.createPolicy({
      name: "Surface Treatment for Asphalt",
      description: "Apply surface treatment for asphalt roads",
      surfaceType: "Asphalt",
      conditionThreshold: 60,
      maintenanceTypeId: 2,
      priority: 2,
      active: "true"
    });
    
    this.createPolicy({
      name: "Mill & Overlay for Asphalt",
      description: "Apply mill & overlay for asphalt roads",
      surfaceType: "Asphalt",
      conditionThreshold: 45,
      maintenanceTypeId: 3,
      priority: 3,
      active: "true"
    });
    
    this.createPolicy({
      name: "Reconstruction for Asphalt",
      description: "Apply reconstruction for asphalt roads",
      surfaceType: "Asphalt",
      conditionThreshold: 30,
      maintenanceTypeId: 4,
      priority: 4,
      active: "true"
    });
    
    // Create audit logs
    this.createAuditLog({
      userId: 1,
      username: "admin",
      action: "SYSTEM_INITIALIZATION",
      details: "System initialized with default data",
      ipAddress: "127.0.0.1",
      resourceType: "SYSTEM",
      resourceId: "0"
    });

    // Create default asset types
    this.createAssetType({
      name: "Pavement Marking",
      description: "Road markings including lane dividers, crosswalks, stop lines, etc.",
      category: "Signage and Marking",
      conditionRatingScale: "1-10",
      conditionRatingType: "numeric",
      inspectionFrequencyMonths: 6,
      active: true
    });

    this.createAssetType({
      name: "Traffic Sign",
      description: "Road signs including regulatory, warning, and informational signs",
      category: "Signage and Marking",
      conditionRatingScale: "1-10",
      conditionRatingType: "numeric",
      inspectionFrequencyMonths: 12,
      active: true
    });

    this.createAssetType({
      name: "Guardrail",
      description: "Safety barriers along roadways to prevent vehicles from leaving the road",
      category: "Safety Equipment",
      conditionRatingScale: "1-10",
      conditionRatingType: "numeric",
      inspectionFrequencyMonths: 12,
      active: true
    });

    this.createAssetType({
      name: "Drainage Structure",
      description: "Culverts, catch basins, and other drainage structures",
      category: "Drainage",
      conditionRatingScale: "1-10",
      conditionRatingType: "numeric",
      inspectionFrequencyMonths: 12,
      active: true
    });

    this.createAssetType({
      name: "Sidewalk",
      description: "Pedestrian walkways alongside roadways",
      category: "Pedestrian Facilities",
      conditionRatingScale: "1-10",
      conditionRatingType: "numeric",
      inspectionFrequencyMonths: 24,
      active: true
    });
    
    // When real data is available, we'll set up initialization
    // of asset inventory system sample data here
  }
  
  // Tenant operations
  async getTenants(): Promise<Tenant[]> {
    return Array.from(this.tenants.values());
  }
  
  async getTenant(id: number): Promise<Tenant | undefined> {
    return this.tenants.get(id);
  }
  
  async getTenantByCode(code: string): Promise<Tenant | undefined> {
    return Array.from(this.tenants.values()).find(t => t.code === code);
  }
  
  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const id = this.tenantIdCounter++;
    const now = new Date();
    const newTenant: Tenant = {
      id,
      ...tenant,
      createdAt: now,
      updatedAt: now,
    };
    this.tenants.set(id, newTenant);
    return newTenant;
  }
  
  async updateTenant(id: number, tenant: Partial<InsertTenant>): Promise<Tenant | undefined> {
    const existingTenant = await this.getTenant(id);
    if (!existingTenant) {
      return undefined;
    }
    
    const updatedTenant: Tenant = {
      ...existingTenant,
      ...tenant,
      updatedAt: new Date(),
    };
    
    this.tenants.set(id, updatedTenant);
    return updatedTenant;
  }
  
  async deleteTenant(id: number): Promise<boolean> {
    if (!this.tenants.has(id)) {
      return false;
    }
    
    // First remove all user-tenant associations
    for (const [key, userTenant] of this.userTenants.entries()) {
      if (userTenant.tenantId === id) {
        this.userTenants.delete(key);
      }
    }
    
    // Then remove all tenant-asset associations
    for (const [key, tenantRoadAsset] of this.tenantRoadAssets.entries()) {
      if (tenantRoadAsset.tenantId === id) {
        this.tenantRoadAssets.delete(key);
      }
    }
    
    for (const [key, tenantRoadwayAsset] of this.tenantRoadwayAssets.entries()) {
      if (tenantRoadwayAsset.tenantId === id) {
        this.tenantRoadwayAssets.delete(key);
      }
    }
    
    // Finally remove the tenant
    return this.tenants.delete(id);
  }
  
  // User-Tenant operations
  async getUserTenants(userId: number): Promise<Tenant[]> {
    const tenantIds: number[] = [];
    
    for (const [key, userTenant] of this.userTenants.entries()) {
      if (userTenant.userId === userId) {
        tenantIds.push(userTenant.tenantId);
      }
    }
    
    const tenants: Tenant[] = [];
    for (const tenantId of tenantIds) {
      const tenant = await this.getTenant(tenantId);
      if (tenant) {
        tenants.push(tenant);
      }
    }
    
    return tenants;
  }
  
  async addUserToTenant(userId: number, tenantId: number, role: string, isAdmin: boolean): Promise<boolean> {
    const user = await this.getUser(userId);
    const tenant = await this.getTenant(tenantId);
    
    if (!user || !tenant) {
      return false;
    }
    
    const key = `${userId}-${tenantId}`;
    this.userTenants.set(key, { userId, tenantId, role, isAdmin });
    return true;
  }
  
  async removeUserFromTenant(userId: number, tenantId: number): Promise<boolean> {
    const key = `${userId}-${tenantId}`;
    return this.userTenants.delete(key);
  }
  
  async updateUserTenantRole(userId: number, tenantId: number, role: string, isAdmin: boolean): Promise<boolean> {
    const key = `${userId}-${tenantId}`;
    const userTenant = this.userTenants.get(key);
    
    if (!userTenant) {
      return false;
    }
    
    this.userTenants.set(key, { ...userTenant, role, isAdmin });
    return true;
  }
  
  async setUserCurrentTenant(userId: number, tenantId: number | null): Promise<User | undefined> {
    // Use direct SQL query to check if user exists
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
    
    const userResult = await this.pool.query(userQuery, [userId]);
    const user = userResult.rows[0];
    
    if (!user) {
      return undefined;
    }
    
    if (tenantId !== null) {
      // Check if tenant exists
      const tenantQuery = `SELECT * FROM tenants WHERE id = $1`;
      const tenantResult = await this.pool.query(tenantQuery, [tenantId]);
      const tenant = tenantResult.rows[0];
      
      if (!tenant) {
        return undefined;
      }
      
      // Check if user has access to this tenant
      const userTenantQuery = `
        SELECT * FROM user_tenants 
        WHERE user_id = $1 AND tenant_id = $2
      `;
      const userTenantResult = await this.pool.query(userTenantQuery, [userId, tenantId]);
      
      if (userTenantResult.rows.length === 0) {
        return undefined;
      }
    }
    
    // Update the user's current tenant
    const updateQuery = `
      UPDATE users
      SET current_tenant_id = $1, updated_at = $2
      WHERE id = $3
      RETURNING 
        id, 
        username, 
        password, 
        full_name AS "fullName", 
        role, 
        email, 
        is_system_admin AS "isSystemAdmin", 
        current_tenant_id AS "currentTenantId"
    `;
    
    const now = new Date();
    const updateResult = await this.pool.query(updateQuery, [tenantId, now, userId]);
    
    return updateResult.rows[0];
  }
  
  // Tenant-Asset operations
  async assignRoadAssetToTenant(tenantId: number, roadAssetId: number): Promise<boolean> {
    const tenant = await this.getTenant(tenantId);
    const roadAsset = await this.getRoadAsset(roadAssetId);
    
    if (!tenant || !roadAsset) {
      return false;
    }
    
    const key = `${tenantId}-${roadAssetId}`;
    this.tenantRoadAssets.set(key, { tenantId, roadAssetId });
    return true;
  }
  
  async removeRoadAssetFromTenant(tenantId: number, roadAssetId: number): Promise<boolean> {
    const key = `${tenantId}-${roadAssetId}`;
    return this.tenantRoadAssets.delete(key);
  }
  
  async getTenantRoadAssets(tenantId: number): Promise<RoadAsset[]> {
    const roadAssetIds: number[] = [];
    
    for (const [key, association] of this.tenantRoadAssets.entries()) {
      if (association.tenantId === tenantId) {
        roadAssetIds.push(association.roadAssetId);
      }
    }
    
    const roadAssets: RoadAsset[] = [];
    for (const roadAssetId of roadAssetIds) {
      const roadAsset = await this.getRoadAsset(roadAssetId);
      if (roadAsset) {
        roadAssets.push(roadAsset);
      }
    }
    
    return roadAssets;
  }
  
  async assignRoadwayAssetToTenant(tenantId: number, roadwayAssetId: number): Promise<boolean> {
    const tenant = await this.getTenant(tenantId);
    const roadwayAsset = await this.getRoadwayAsset(roadwayAssetId);
    
    if (!tenant || !roadwayAsset) {
      return false;
    }
    
    const key = `${tenantId}-${roadwayAssetId}`;
    this.tenantRoadwayAssets.set(key, { tenantId, roadwayAssetId });
    return true;
  }
  
  async removeRoadwayAssetFromTenant(tenantId: number, roadwayAssetId: number): Promise<boolean> {
    const key = `${tenantId}-${roadwayAssetId}`;
    return this.tenantRoadwayAssets.delete(key);
  }
  
  async getTenantRoadwayAssets(tenantId: number): Promise<RoadwayAsset[]> {
    const roadwayAssetIds: number[] = [];
    
    for (const [key, association] of this.tenantRoadwayAssets.entries()) {
      if (association.tenantId === tenantId) {
        roadwayAssetIds.push(association.roadwayAssetId);
      }
    }
    
    const roadwayAssets: RoadwayAsset[] = [];
    for (const roadwayAssetId of roadwayAssetIds) {
      const roadwayAsset = await this.getRoadwayAsset(roadwayAssetId);
      if (roadwayAsset) {
        roadwayAssets.push(roadwayAsset);
      }
    }
    
    return roadwayAssets;
  }
  
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.username === username);
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const now = new Date();
    const newUser: User = {
      id,
      ...insertUser,
      isSystemAdmin: insertUser.isSystemAdmin || false,
      currentTenantId: insertUser.currentTenantId || null,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(id, newUser);
    return newUser;
  }
  
  async updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined> {
    const existingUser = await this.getUser(id);
    if (!existingUser) {
      return undefined;
    }
    
    const updatedUser: User = {
      ...existingUser,
      ...user,
      updatedAt: new Date(),
    };
    
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    const existingUser = await this.getUser(id);
    if (!existingUser) {
      return false;
    }
    
    // Remove all user-tenant associations for this user
    Array.from(this.userTenants.entries())
      .filter(([key, value]) => value.userId === id)
      .forEach(([key]) => this.userTenants.delete(key));
    
    // Remove the user
    return this.users.delete(id);
  }
  
  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
  
  async getAllUserTenants(): Promise<UserTenant[]> {
    return Array.from(this.userTenants.entries()).map(([key, value]) => {
      const [userId, tenantId] = key.split('-').map(Number);
      return {
        id: parseInt(key),
        userId,
        tenantId,
        role: value.role,
        isAdmin: value.isAdmin,
        createdAt: new Date()
      };
    });
  }
  
  async createUserTenant(userTenant: { userId: number, tenantId: number, role: string, isAdmin: boolean }): Promise<UserTenant> {
    const { userId, tenantId, role, isAdmin } = userTenant;
    const key = `${userId}-${tenantId}`;
    
    // Make sure user and tenant exist
    const user = await this.getUser(userId);
    const tenant = await this.getTenant(tenantId);
    
    if (!user || !tenant) {
      throw new Error("User or tenant does not exist");
    }
    
    // Create the association
    this.userTenants.set(key, { userId, tenantId, role, isAdmin });
    
    return {
      id: parseInt(key),
      userId,
      tenantId,
      role,
      isAdmin,
      createdAt: new Date()
    };
  }
  
  async updateUserTenant(id: number, updates: Partial<{ role: string, isAdmin: boolean }>): Promise<UserTenant | undefined> {
    // In this implementation, id is the composite key "{userId}-{tenantId}"
    const key = id.toString();
    const existing = this.userTenants.get(key);
    
    if (!existing) {
      return undefined;
    }
    
    const updated = {
      ...existing,
      ...updates
    };
    
    this.userTenants.set(key, updated);
    
    return {
      id,
      userId: existing.userId,
      tenantId: existing.tenantId,
      role: updated.role,
      isAdmin: updated.isAdmin,
      createdAt: new Date()
    };
  }
  
  async deleteUserTenant(id: number): Promise<boolean> {
    // In this implementation, id is the composite key "{userId}-{tenantId}"
    const key = id.toString();
    return this.userTenants.delete(key);
  }
  
  async getRoadAssets(tenantId?: number): Promise<RoadAsset[]> {
    if (tenantId) {
      // If tenantId is provided, return only road assets for that tenant
      const roadAssetIds = new Set<number>();
      
      for (const [key, association] of this.tenantRoadAssets.entries()) {
        if (association.tenantId === tenantId) {
          roadAssetIds.add(association.roadAssetId);
        }
      }
      
      return Array.from(this.roadAssets.values())
        .filter(asset => roadAssetIds.has(asset.id));
    } else {
      // Otherwise return all road assets
      return Array.from(this.roadAssets.values());
    }
  }

  async getRoadAssetsByTenants(tenantIds: number[]): Promise<RoadAsset[]> {
    const roadAssetIds = new Set<number>();
    
    for (const [key, association] of this.tenantRoadAssets.entries()) {
      if (tenantIds.includes(association.tenantId)) {
        roadAssetIds.add(association.roadAssetId);
      }
    }
    
    return Array.from(this.roadAssets.values())
      .filter(asset => roadAssetIds.has(asset.id));
  }
  
  async getRoadAsset(id: number): Promise<RoadAsset | undefined> {
    return this.roadAssets.get(id);
  }
  
  async getRoadAssetByAssetId(assetId: string): Promise<RoadAsset | undefined> {
    return Array.from(this.roadAssets.values()).find(a => a.assetId === assetId);
  }
  
  async createRoadAsset(asset: InsertRoadAsset): Promise<RoadAsset> {
    const id = this.roadAssetIdCounter++;
    const now = new Date();
    const roadAsset: RoadAsset = { 
      ...asset, 
      id,
      createdAt: now,
      updatedAt: now
    };
    this.roadAssets.set(id, roadAsset);
    return roadAsset;
  }
  
  async updateRoadAsset(id: number, asset: Partial<InsertRoadAsset>): Promise<RoadAsset | undefined> {
    const existingAsset = this.roadAssets.get(id);
    if (!existingAsset) return undefined;
    
    const updatedAsset: RoadAsset = {
      ...existingAsset,
      ...asset,
      updatedAt: new Date()
    };
    
    this.roadAssets.set(id, updatedAsset);
    return updatedAsset;
  }
  
  async deleteRoadAsset(id: number): Promise<boolean> {
    return this.roadAssets.delete(id);
  }
  
  async getMaintenanceTypes(): Promise<MaintenanceType[]> {
    return Array.from(this.maintenanceTypes.values());
  }
  
  async getMaintenanceType(id: number): Promise<MaintenanceType | undefined> {
    return this.maintenanceTypes.get(id);
  }
  
  async createMaintenanceType(type: InsertMaintenanceType): Promise<MaintenanceType> {
    const id = this.maintenanceTypeIdCounter++;
    const maintenanceType: MaintenanceType = { ...type, id };
    this.maintenanceTypes.set(id, maintenanceType);
    return maintenanceType;
  }
  
  async updateMaintenanceType(id: number, type: Partial<InsertMaintenanceType>): Promise<MaintenanceType | undefined> {
    const existingType = this.maintenanceTypes.get(id);
    if (!existingType) return undefined;
    
    const updatedType: MaintenanceType = {
      ...existingType,
      ...type
    };
    
    this.maintenanceTypes.set(id, updatedType);
    return updatedType;
  }
  
  async deleteMaintenanceType(id: number): Promise<boolean> {
    return this.maintenanceTypes.delete(id);
  }
  
  async getMaintenanceProjects(): Promise<MaintenanceProject[]> {
    return Array.from(this.maintenanceProjects.values());
  }
  
  async getMaintenanceProject(id: number): Promise<MaintenanceProject | undefined> {
    return this.maintenanceProjects.get(id);
  }
  
  async createMaintenanceProject(project: InsertMaintenanceProject): Promise<MaintenanceProject> {
    const id = this.maintenanceProjectIdCounter++;
    const maintenanceProject: MaintenanceProject = { 
      ...project, 
      id,
      createdAt: new Date()
    };
    this.maintenanceProjects.set(id, maintenanceProject);
    return maintenanceProject;
  }
  
  async updateMaintenanceProject(id: number, project: Partial<InsertMaintenanceProject>): Promise<MaintenanceProject | undefined> {
    const existingProject = this.maintenanceProjects.get(id);
    if (!existingProject) return undefined;
    
    const updatedProject: MaintenanceProject = {
      ...existingProject,
      ...project
    };
    
    this.maintenanceProjects.set(id, updatedProject);
    return updatedProject;
  }
  
  async deleteMaintenanceProject(id: number): Promise<boolean> {
    return this.maintenanceProjects.delete(id);
  }
  
  async getPolicies(): Promise<Policy[]> {
    return Array.from(this.policies.values());
  }
  
  async getPolicy(id: number): Promise<Policy | undefined> {
    return this.policies.get(id);
  }
  
  async createPolicy(policy: InsertPolicy): Promise<Policy> {
    const id = this.policyIdCounter++;
    const now = new Date();
    const newPolicy: Policy = { 
      ...policy, 
      id,
      createdAt: now,
      updatedAt: now
    };
    this.policies.set(id, newPolicy);
    return newPolicy;
  }
  
  async updatePolicy(id: number, policy: Partial<InsertPolicy>): Promise<Policy | undefined> {
    const existingPolicy = this.policies.get(id);
    if (!existingPolicy) return undefined;
    
    const updatedPolicy: Policy = {
      ...existingPolicy,
      ...policy,
      updatedAt: new Date()
    };
    
    this.policies.set(id, updatedPolicy);
    return updatedPolicy;
  }
  
  async deletePolicy(id: number): Promise<boolean> {
    return this.policies.delete(id);
  }
  
  async getBudgetAllocations(): Promise<BudgetAllocation[]> {
    return Array.from(this.budgetAllocations.values());
  }
  
  async getBudgetAllocation(id: number): Promise<BudgetAllocation | undefined> {
    return this.budgetAllocations.get(id);
  }
  
  async getActiveBudgetAllocation(): Promise<BudgetAllocation | undefined> {
    return Array.from(this.budgetAllocations.values()).find(b => b.active === "true");
  }
  
  async createBudgetAllocation(budget: InsertBudgetAllocation): Promise<BudgetAllocation> {
    const id = this.budgetAllocationIdCounter++;
    const budgetAllocation: BudgetAllocation = { 
      ...budget, 
      id,
      createdAt: new Date()
    };
    this.budgetAllocations.set(id, budgetAllocation);
    return budgetAllocation;
  }
  
  async updateBudgetAllocation(id: number, budget: Partial<InsertBudgetAllocation>): Promise<BudgetAllocation | undefined> {
    const existingBudget = this.budgetAllocations.get(id);
    if (!existingBudget) return undefined;
    
    const updatedBudget: BudgetAllocation = {
      ...existingBudget,
      ...budget
    };
    
    this.budgetAllocations.set(id, updatedBudget);
    return updatedBudget;
  }
  
  async setBudgetAllocationActive(id: number): Promise<BudgetAllocation | undefined> {
    // First, set all allocations to inactive
    for (const budget of this.budgetAllocations.values()) {
      budget.active = "false";
    }
    
    // Then set the specified one to active
    const budget = this.budgetAllocations.get(id);
    if (!budget) return undefined;
    
    budget.active = "true";
    return budget;
  }
  
  async deleteBudgetAllocation(id: number): Promise<boolean> {
    return this.budgetAllocations.delete(id);
  }
  
  // Moisture reading operations
  async getMoistureReadings(roadAssetId: number): Promise<MoistureReading[]> {
    return Array.from(this.moistureReadings.values())
      .filter(reading => reading.roadAssetId === roadAssetId)
      .sort((a, b) => b.readingDate.getTime() - a.readingDate.getTime());
  }

  // Get only the latest moisture reading per coordinate (optimized for map view)
  async getLatestMoistureReadings(): Promise<Record<string, MoistureReading>> {
    const latestReadings: Record<string, MoistureReading> = {};
    
    for (const reading of this.moistureReadings.values()) {
      // Create coordinate key from lat/lng
      const coordinateKey = `${reading.latitude},${reading.longitude}`;
      
      // Use createdAt (import timestamp) to determine latest reading for this coordinate
      if (!latestReadings[coordinateKey] || reading.createdAt > latestReadings[coordinateKey].createdAt) {
        latestReadings[coordinateKey] = reading;
      }
    }
    
    return latestReadings;
  }
  
  async getMoistureReading(id: number): Promise<MoistureReading | undefined> {
    return this.moistureReadings.get(id);
  }
  
  async createMoistureReading(reading: InsertMoistureReading): Promise<MoistureReading> {
    const id = this.moistureReadingIdCounter++;
    const newReading: MoistureReading = {
      ...reading,
      id,
      createdAt: new Date()
    };
    this.moistureReadings.set(id, newReading);
    return newReading;
  }
  
  async updateMoistureReading(id: number, reading: Partial<InsertMoistureReading>): Promise<MoistureReading | undefined> {
    const existingReading = this.moistureReadings.get(id);
    if (!existingReading) return undefined;
    
    const updatedReading: MoistureReading = {
      ...existingReading,
      ...reading
    };
    
    this.moistureReadings.set(id, updatedReading);
    return updatedReading;
  }
  
  async deleteMoistureReading(id: number): Promise<boolean> {
    return this.moistureReadings.delete(id);
  }
  
  async deleteMoistureReadingsByRoadAsset(roadAssetId: number): Promise<boolean> {
    let deleted = false;
    for (const [id, reading] of this.moistureReadings.entries()) {
      if (reading.roadAssetId === roadAssetId) {
        this.moistureReadings.delete(id);
        deleted = true;
      }
    }
    return deleted;
  }

  async getAuditLogs(): Promise<AuditLog[]> {
    return Array.from(this.auditLogs.values()).sort((a, b) => 
      b.timestamp.getTime() - a.timestamp.getTime()
    );
  }
  
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const id = this.auditLogIdCounter++;
    const auditLog: AuditLog = { 
      ...log, 
      id,
      timestamp: new Date()
    };
    this.auditLogs.set(id, auditLog);
    return auditLog;
  }

  // Asset Type methods
  async getAssetTypes(): Promise<AssetType[]> {
    return Array.from(this.assetTypes.values());
  }

  async getAssetType(id: number): Promise<AssetType | undefined> {
    return this.assetTypes.get(id);
  }

  async createAssetType(type: InsertAssetType): Promise<AssetType> {
    const id = this.assetTypeIdCounter++;
    const now = new Date();
    const assetType: AssetType = {
      ...type,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.assetTypes.set(id, assetType);
    return assetType;
  }

  async updateAssetType(id: number, type: Partial<InsertAssetType>): Promise<AssetType | undefined> {
    const existingType = this.assetTypes.get(id);
    if (!existingType) return undefined;

    const updatedType: AssetType = {
      ...existingType,
      ...type,
      updatedAt: new Date()
    };

    this.assetTypes.set(id, updatedType);
    return updatedType;
  }

  async deleteAssetType(id: number): Promise<boolean> {
    return this.assetTypes.delete(id);
  }

  // Roadway Asset methods
  async getRoadwayAssets(tenantId?: number): Promise<RoadwayAsset[]> {
    if (tenantId) {
      // If tenantId is provided, return only roadway assets for that tenant
      const roadwayAssetIds = new Set<number>();
      
      // First check explicit tenant associations
      for (const [key, association] of this.tenantRoadwayAssets.entries()) {
        if (association.tenantId === tenantId) {
          roadwayAssetIds.add(association.roadwayAssetId);
        }
      }
      
      // Get all assets that either:
      // 1. Are explicitly associated with the tenant (via the tenant-asset association)
      // 2. OR have the tenantId property set to match the requested tenant
      // 3. AND are not associated with any other tenant in the explicit association table
      return Array.from(this.roadwayAssets.values())
        .filter(asset => {
          // Check if the asset explicitly has this tenant ID
          if (asset.tenantId === tenantId) {
            return true;
          }

          // Check if the asset is explicitly associated with this tenant
          if (roadwayAssetIds.has(asset.id)) {
            return true;
          }

          // For assets with no explicit tenant ID, check if they're explicitly 
          // associated with any tenant - if not, they're available to all tenants
          if (asset.tenantId === null || asset.tenantId === undefined) {
            // Check if this asset is associated with any tenant explicitly
            const isAssociatedWithAnyTenant = Array.from(this.tenantRoadwayAssets.entries())
              .some(([_, assoc]) => assoc.roadwayAssetId === asset.id);
            
            // If not associated with any tenant, it's available for all
            return !isAssociatedWithAnyTenant;
          }
          
          // Otherwise, this asset belongs to another tenant
          return false;
        });
    } else {
      // When no tenantId is provided (system admin view), return all roadway assets
      // but log a warning as this should generally not happen in production
      console.warn("Warning: Retrieving all roadway assets without tenant filtering");
      return Array.from(this.roadwayAssets.values());
    }
  }

  async getRoadwayAssetsByType(assetTypeId: number, tenantId?: number): Promise<RoadwayAsset[]> {
    // First filter by asset type
    const typeFilteredAssets = Array.from(this.roadwayAssets.values())
      .filter(asset => asset.assetTypeId === assetTypeId);
    
    // If no tenant filter is applied, return all assets of the specified type
    if (!tenantId) {
      return typeFilteredAssets;
    }

    // Apply tenant filtering
    const roadwayAssetIds = new Set<number>();
    
    // Collect tenant-associated roadway asset IDs
    for (const [_, association] of this.tenantRoadwayAssets.entries()) {
      if (association.tenantId === tenantId) {
        roadwayAssetIds.add(association.roadwayAssetId);
      }
    }

    // Apply the same tenant filtering logic as in getRoadwayAssets but for assets that match the type
    return typeFilteredAssets.filter(asset => {
      // Check if the asset explicitly has this tenant ID
      if (asset.tenantId === tenantId) {
        return true;
      }

      // Check if the asset is explicitly associated with this tenant
      if (roadwayAssetIds.has(asset.id)) {
        return true;
      }

      // For assets with no explicit tenant ID, check if they're explicitly 
      // associated with any tenant - if not, they're available to all tenants
      if (asset.tenantId === null || asset.tenantId === undefined) {
        // Check if this asset is associated with any tenant explicitly
        const isAssociatedWithAnyTenant = Array.from(this.tenantRoadwayAssets.entries())
          .some(([_, assoc]) => assoc.roadwayAssetId === asset.id);
        
        // If not associated with any tenant, it's available for all
        return !isAssociatedWithAnyTenant;
      }
      
      // Otherwise, this asset belongs to another tenant
      return false;
    });
  }

  async getRoadwayAsset(id: number, tenantId?: number): Promise<RoadwayAsset | undefined> {
    const asset = this.roadwayAssets.get(id);
    if (!asset) return undefined;
    
    // If no tenant filter or system admin view, return the asset
    if (!tenantId) return asset;
    
    // Check if the asset explicitly has this tenant ID
    if (asset.tenantId === tenantId) {
      return asset;
    }
    
    // Check if asset is explicitly associated with this tenant
    for (const [_, association] of this.tenantRoadwayAssets.entries()) {
      if (association.roadwayAssetId === id && association.tenantId === tenantId) {
        return asset;
      }
    }
    
    // If asset has no tenant ID and isn't explicitly associated with any tenant,
    // it's available to all tenants
    if (asset.tenantId === null || asset.tenantId === undefined) {
      // Check if this asset is associated with any tenant explicitly
      const isAssociatedWithAnyTenant = Array.from(this.tenantRoadwayAssets.entries())
        .some(([_, assoc]) => assoc.roadwayAssetId === id);
      
      // If not associated with any tenant, it's available for all
      if (!isAssociatedWithAnyTenant) {
        return asset;
      }
    }
    
    // Asset is not accessible to this tenant
    return undefined;
  }

  async createRoadwayAsset(asset: InsertRoadwayAsset): Promise<RoadwayAsset> {
    const id = this.roadwayAssetIdCounter++;
    const now = new Date();
    const roadwayAsset: RoadwayAsset = {
      ...asset,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.roadwayAssets.set(id, roadwayAsset);
    return roadwayAsset;
  }

  async updateRoadwayAsset(id: number, asset: Partial<InsertRoadwayAsset>): Promise<RoadwayAsset | undefined> {
    const existingAsset = this.roadwayAssets.get(id);
    if (!existingAsset) return undefined;

    const updatedAsset: RoadwayAsset = {
      ...existingAsset,
      ...asset,
      updatedAt: new Date()
    };

    this.roadwayAssets.set(id, updatedAsset);
    return updatedAsset;
  }

  async deleteRoadwayAsset(id: number): Promise<boolean> {
    return this.roadwayAssets.delete(id);
  }

  // Asset Inspection methods
  async getAssetInspections(): Promise<AssetInspection[]> {
    return Array.from(this.assetInspections.values());
  }

  async getAssetInspectionsByAssetId(roadwayAssetId: number): Promise<AssetInspection[]> {
    return Array.from(this.assetInspections.values())
      .filter(inspection => inspection.roadwayAssetId === roadwayAssetId)
      .sort((a, b) => b.inspectionDate.getTime() - a.inspectionDate.getTime()); // Sort by date, newest first
  }

  async getAssetInspection(id: number): Promise<AssetInspection | undefined> {
    return this.assetInspections.get(id);
  }

  async createAssetInspection(inspection: InsertAssetInspection): Promise<AssetInspection> {
    const id = this.assetInspectionIdCounter++;
    const now = new Date();
    const assetInspection: AssetInspection = {
      ...inspection,
      id,
      createdAt: now
    };
    this.assetInspections.set(id, assetInspection);
    return assetInspection;
  }

  async updateAssetInspection(id: number, inspection: Partial<InsertAssetInspection>): Promise<AssetInspection | undefined> {
    const existingInspection = this.assetInspections.get(id);
    if (!existingInspection) return undefined;

    const updatedInspection: AssetInspection = {
      ...existingInspection,
      ...inspection
    };

    this.assetInspections.set(id, updatedInspection);
    return updatedInspection;
  }

  async deleteAssetInspection(id: number): Promise<boolean> {
    return this.assetInspections.delete(id);
  }

  // Asset Maintenance Record methods
  async getAssetMaintenanceRecords(): Promise<AssetMaintenanceRecord[]> {
    return Array.from(this.assetMaintenanceRecords.values());
  }

  async getAssetMaintenanceRecordsByAssetId(roadwayAssetId: number): Promise<AssetMaintenanceRecord[]> {
    return Array.from(this.assetMaintenanceRecords.values())
      .filter(record => record.roadwayAssetId === roadwayAssetId)
      .sort((a, b) => b.maintenanceDate.getTime() - a.maintenanceDate.getTime()); // Sort by date, newest first
  }

  async getAssetMaintenanceRecord(id: number): Promise<AssetMaintenanceRecord | undefined> {
    return this.assetMaintenanceRecords.get(id);
  }

  async createAssetMaintenanceRecord(record: InsertAssetMaintenanceRecord): Promise<AssetMaintenanceRecord> {
    const id = this.assetMaintenanceRecordIdCounter++;
    const now = new Date();
    const maintenanceRecord: AssetMaintenanceRecord = {
      ...record,
      id,
      createdAt: now
    };
    this.assetMaintenanceRecords.set(id, maintenanceRecord);
    return maintenanceRecord;
  }

  async updateAssetMaintenanceRecord(id: number, record: Partial<InsertAssetMaintenanceRecord>): Promise<AssetMaintenanceRecord | undefined> {
    const existingRecord = this.assetMaintenanceRecords.get(id);
    if (!existingRecord) return undefined;

    const updatedRecord: AssetMaintenanceRecord = {
      ...existingRecord,
      ...record
    };

    this.assetMaintenanceRecords.set(id, updatedRecord);
    return updatedRecord;
  }

  async deleteAssetMaintenanceRecord(id: number): Promise<boolean> {
    return this.assetMaintenanceRecords.delete(id);
  }
}

// DatabaseStorage implementation
export class DatabaseStorage implements IStorage {
  private pool;
  
  constructor() {
    this.pool = pool;
  }
  // Tenant operations
  async getTenants(): Promise<Tenant[]> {
    return await db.select().from(tenants);
  }
  
  async getTenant(id: number): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant;
  }
  
  async getTenantByCode(code: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.code, code));
    return tenant;
  }
  
  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const now = new Date();
    const [newTenant] = await db.insert(tenants).values({
      ...tenant,
      createdAt: now,
      updatedAt: now
    }).returning();
    return newTenant;
  }
  
  async updateTenant(id: number, tenant: Partial<InsertTenant>): Promise<Tenant | undefined> {
    const [updatedTenant] = await db.update(tenants)
      .set({
        ...tenant,
        updatedAt: new Date()
      })
      .where(eq(tenants.id, id))
      .returning();
    return updatedTenant;
  }
  
  async deleteTenant(id: number): Promise<boolean> {
    // First remove user-tenant associations
    await db.delete(userTenants).where(eq(userTenants.tenantId, id));
    
    // Then remove tenant-asset associations
    await db.delete(tenantRoadAssets).where(eq(tenantRoadAssets.tenantId, id));
    await db.delete(tenantRoadwayAssets).where(eq(tenantRoadwayAssets.tenantId, id));
    
    // Finally remove the tenant
    const result = await db.delete(tenants).where(eq(tenants.id, id));
    return result.rowCount > 0;
  }
  
  // User-Tenant operations
  async getUserTenants(userId: number): Promise<Tenant[]> {
    const result = await db.select({
      tenant: tenants
    })
    .from(userTenants)
    .innerJoin(tenants, eq(userTenants.tenantId, tenants.id))
    .where(eq(userTenants.userId, userId));
    
    return result.map(r => r.tenant);
  }
  
  async addUserToTenant(userId: number, tenantId: number, role: string, isAdmin: boolean): Promise<boolean> {
    try {
      await db.insert(userTenants).values({
        userId,
        tenantId,
        role,
        isAdmin
      });
      return true;
    } catch (error) {
      console.error("Error adding user to tenant:", error);
      return false;
    }
  }
  
  async removeUserFromTenant(userId: number, tenantId: number): Promise<boolean> {
    const result = await db.delete(userTenants)
      .where(
        and(
          eq(userTenants.userId, userId),
          eq(userTenants.tenantId, tenantId)
        )
      );
    return result.rowCount > 0;
  }
  
  async updateUserTenantRole(userId: number, tenantId: number, role: string, isAdmin: boolean): Promise<boolean> {
    const result = await db.update(userTenants)
      .set({
        role,
        isAdmin,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(userTenants.userId, userId),
          eq(userTenants.tenantId, tenantId)
        )
      );
    return result.rowCount > 0;
  }
  
  async setUserCurrentTenant(userId: number, tenantId: number | null): Promise<User | undefined> {
    // If tenantId is not null, check if user has access to this tenant
    if (tenantId !== null) {
      const [userTenant] = await db.select()
        .from(userTenants)
        .where(
          and(
            eq(userTenants.userId, userId),
            eq(userTenants.tenantId, tenantId)
          )
        );
      
      if (!userTenant) {
        return undefined;
      }
    }
    
    const [updatedUser] = await db.update(users)
      .set({
        currentTenantId: tenantId,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    
    return updatedUser;
  }
  
  // Tenant-Asset operations
  async assignRoadAssetToTenant(tenantId: number, roadAssetId: number): Promise<boolean> {
    try {
      await db.insert(tenantRoadAssets).values({
        tenantId,
        roadAssetId
      }).onConflictDoNothing();
      return true;
    } catch (error) {
      console.error("Error assigning road asset to tenant:", error);
      return false;
    }
  }
  
  async removeRoadAssetFromTenant(tenantId: number, roadAssetId: number): Promise<boolean> {
    const result = await db.delete(tenantRoadAssets)
      .where(
        and(
          eq(tenantRoadAssets.tenantId, tenantId),
          eq(tenantRoadAssets.roadAssetId, roadAssetId)
        )
      );
    return result.rowCount > 0;
  }
  
  async getTenantRoadAssets(tenantId: number): Promise<RoadAsset[]> {
    const result = await db.select({
      roadAsset: roadAssets
    })
    .from(tenantRoadAssets)
    .innerJoin(roadAssets, eq(tenantRoadAssets.roadAssetId, roadAssets.id))
    .where(eq(tenantRoadAssets.tenantId, tenantId));
    
    return result.map(r => r.roadAsset);
  }
  
  async assignRoadwayAssetToTenant(tenantId: number, roadwayAssetId: number): Promise<boolean> {
    try {
      await db.insert(tenantRoadwayAssets).values({
        tenantId,
        roadwayAssetId
      }).onConflictDoNothing();
      return true;
    } catch (error) {
      console.error("Error assigning roadway asset to tenant:", error);
      return false;
    }
  }
  
  async removeRoadwayAssetFromTenant(tenantId: number, roadwayAssetId: number): Promise<boolean> {
    const result = await db.delete(tenantRoadwayAssets)
      .where(
        and(
          eq(tenantRoadwayAssets.tenantId, tenantId),
          eq(tenantRoadwayAssets.roadwayAssetId, roadwayAssetId)
        )
      );
    return result.rowCount > 0;
  }
  
  async getTenantRoadwayAssets(tenantId: number): Promise<RoadwayAsset[]> {
    const result = await db.select({
      roadwayAsset: roadwayAssets
    })
    .from(tenantRoadwayAssets)
    .innerJoin(roadwayAssets, eq(tenantRoadwayAssets.roadwayAssetId, roadwayAssets.id))
    .where(eq(tenantRoadwayAssets.tenantId, tenantId));
    
    return result.map(r => r.roadwayAsset);
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    // Use direct SQL query to avoid ORM schema discrepancies
    const query = `
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
    
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    // Use direct SQL query to avoid ORM schema discrepancies
    const query = `
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
      WHERE username = $1
    `;
    
    const result = await pool.query(query, [username]);
    return result.rows[0];
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    // Use direct SQL query to avoid ORM schema discrepancies
    const {
      username,
      password,
      fullName,
      role,
      email,
      isSystemAdmin
    } = insertUser;
    
    const query = `
      INSERT INTO users (
        username, 
        password, 
        full_name, 
        role, 
        email, 
        is_system_admin
      ) 
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING 
        id, 
        username, 
        password, 
        full_name AS "fullName", 
        role, 
        email, 
        is_system_admin AS "isSystemAdmin", 
        current_tenant_id AS "currentTenantId"
    `;
    
    const result = await pool.query(query, [
      username,
      password,
      fullName,
      role,
      email,
      isSystemAdmin || false
    ]);
    
    return result.rows[0];
  }
  
  async updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined> {
    // Check if user exists
    const existingUser = await this.getUser(id);
    if (!existingUser) {
      return undefined;
    }
    
    // Build the update query dynamically based on what fields are being updated
    let updateFields = '';
    const params = [id];
    let paramIndex = 2;
    
    if (user.username !== undefined) {
      updateFields += `username = $${paramIndex}, `;
      params.push(user.username);
      paramIndex++;
    }
    
    if (user.password !== undefined) {
      updateFields += `password = $${paramIndex}, `;
      params.push(user.password);
      paramIndex++;
    }
    
    if (user.fullName !== undefined) {
      updateFields += `full_name = $${paramIndex}, `;
      params.push(user.fullName);
      paramIndex++;
    }
    
    if (user.role !== undefined) {
      updateFields += `role = $${paramIndex}, `;
      params.push(user.role);
      paramIndex++;
    }
    
    if (user.email !== undefined) {
      updateFields += `email = $${paramIndex}, `;
      params.push(user.email);
      paramIndex++;
    }
    
    if (user.isSystemAdmin !== undefined) {
      updateFields += `is_system_admin = $${paramIndex}, `;
      params.push(user.isSystemAdmin);
      paramIndex++;
    }
    
    // Always update the updated_at timestamp
    const now = new Date();
    updateFields += `updated_at = $${paramIndex}`;
    params.push(now);
    
    // Update the user using direct SQL
    const updateQuery = `
      UPDATE users
      SET ${updateFields}
      WHERE id = $1
      RETURNING 
        id, 
        username, 
        password, 
        full_name AS "fullName", 
        role, 
        email, 
        is_system_admin AS "isSystemAdmin", 
        current_tenant_id AS "currentTenantId"
    `;
    
    const result = await pool.query(updateQuery, params);
    return result.rows[0];
  }
  
  async deleteUser(id: number): Promise<boolean> {
    // First, remove all user-tenant associations using direct SQL
    const deleteAssociationsQuery = `DELETE FROM user_tenants WHERE user_id = $1`;
    await pool.query(deleteAssociationsQuery, [id]);
    
    // Then delete the user using direct SQL
    const deleteUserQuery = `DELETE FROM users WHERE id = $1`;
    const result = await pool.query(deleteUserQuery, [id]);
    
    return result.rowCount > 0;
  }
  
  async getUsers(): Promise<User[]> {
    // Use direct SQL query to avoid ORM schema discrepancies
    const query = `
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
      ORDER BY username
    `;
    
    const result = await this.pool.query(query);
    return result.rows;
  }
  
  async getAllUserTenants(): Promise<UserTenant[]> {
    // Use direct SQL query to avoid ORM schema discrepancies
    const query = `
      SELECT 
        id, 
        user_id AS "userId", 
        tenant_id AS "tenantId", 
        role, 
        is_admin AS "isAdmin"
      FROM user_tenants
    `;
    
    const result = await this.pool.query(query);
    return result.rows;
  }
  
  async createUserTenant(userTenant: { userId: number, tenantId: number, role: string, isAdmin: boolean }): Promise<UserTenant> {
    const { userId, tenantId, role, isAdmin } = userTenant;
    
    // Make sure user and tenant exist using direct SQL
    const userQuery = `SELECT * FROM users WHERE id = $1`;
    const userResult = await this.pool.query(userQuery, [userId]);
    const user = userResult.rows[0];
    
    const tenantQuery = `SELECT * FROM tenants WHERE id = $1`;
    const tenantResult = await this.pool.query(tenantQuery, [tenantId]);
    const tenant = tenantResult.rows[0];
    
    if (!user || !tenant) {
      throw new Error("User or tenant does not exist");
    }
    
    // Insert the new user-tenant relationship using direct SQL
    const now = new Date();
    const insertQuery = `
      INSERT INTO user_tenants (user_id, tenant_id, role, is_admin, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, user_id AS "userId", tenant_id AS "tenantId", role, is_admin AS "isAdmin"
    `;
    
    const result = await this.pool.query(insertQuery, [userId, tenantId, role, isAdmin, now, now]);
    return result.rows[0];
  }
  
  async updateUserTenant(id: number, updates: Partial<{ role: string, isAdmin: boolean }>): Promise<UserTenant | undefined> {
    // Check if the user-tenant relationship exists using direct SQL
    const checkQuery = `SELECT * FROM user_tenants WHERE id = $1`;
    const checkResult = await this.pool.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return undefined;
    }
    
    // Build the update query dynamically based on what fields are being updated
    let updateFields = '';
    const params = [id];
    let paramIndex = 2;
    
    if (updates.role !== undefined) {
      updateFields += `role = $${paramIndex}, `;
      params.push(updates.role);
      paramIndex++;
    }
    
    if (updates.isAdmin !== undefined) {
      updateFields += `is_admin = $${paramIndex}, `;
      params.push(updates.isAdmin);
      paramIndex++;
    }
    
    // Always update the updated_at timestamp
    const now = new Date();
    updateFields += `updated_at = $${paramIndex}`;
    params.push(now);
    
    // Update the user-tenant relationship using direct SQL
    const updateQuery = `
      UPDATE user_tenants
      SET ${updateFields}
      WHERE id = $1
      RETURNING id, user_id AS "userId", tenant_id AS "tenantId", role, is_admin AS "isAdmin"
    `;
    
    const result = await this.pool.query(updateQuery, params);
    return result.rows[0];
  }
  
  async deleteUserTenant(id: number): Promise<boolean> {
    // Delete the user-tenant relationship using direct SQL
    const deleteQuery = `DELETE FROM user_tenants WHERE id = $1`;
    const result = await this.pool.query(deleteQuery, [id]);
    
    return result.rowCount > 0;
  }
  
  // Road asset methods
  async getRoadAssets(tenantId?: number): Promise<RoadAsset[]> {
    if (tenantId) {
      // If tenantId is provided, only return road assets for that tenant
      return await db.select().from(roadAssets).where(eq(roadAssets.tenantId, tenantId));
    } else {
      // Otherwise return all road assets
      return await db.select().from(roadAssets);
    }
  }

  async getRoadAssetsByTenants(tenantIds: number[]): Promise<RoadAsset[]> {
    if (tenantIds.length === 0) {
      return [];
    }
    
    // Use SQL IN clause to get assets for multiple tenants
    const query = `
      SELECT * FROM road_assets 
      WHERE tenant_id = ANY($1)
      ORDER BY name
    `;
    
    const result = await this.pool.query(query, [tenantIds]);
    return result.rows;
  }
  
  async getRoadAsset(id: number): Promise<RoadAsset | undefined> {
    const [asset] = await db.select().from(roadAssets).where(eq(roadAssets.id, id));
    return asset;
  }
  
  async getRoadAssetByAssetId(assetId: string): Promise<RoadAsset | undefined> {
    const [asset] = await db.select().from(roadAssets).where(eq(roadAssets.assetId, assetId));
    return asset;
  }
  
  async createRoadAsset(asset: InsertRoadAsset): Promise<RoadAsset> {
    const now = new Date();
    const [newAsset] = await db.insert(roadAssets).values({
      ...asset,
      createdAt: now,
      updatedAt: now
    }).returning();
    return newAsset;
  }
  
  async updateRoadAsset(id: number, asset: Partial<InsertRoadAsset>): Promise<RoadAsset | undefined> {
    const [updatedAsset] = await db.update(roadAssets)
      .set({
        ...asset,
        updatedAt: new Date()
      })
      .where(eq(roadAssets.id, id))
      .returning();
    return updatedAsset;
  }
  
  async deleteRoadAsset(id: number): Promise<boolean> {
    const result = await db.delete(roadAssets).where(eq(roadAssets.id, id));
    return result.rowCount > 0;
  }
  
  // Maintenance type methods
  async getMaintenanceTypes(): Promise<MaintenanceType[]> {
    return await db.select().from(maintenanceTypes);
  }
  
  async getMaintenanceType(id: number): Promise<MaintenanceType | undefined> {
    const [type] = await db.select().from(maintenanceTypes).where(eq(maintenanceTypes.id, id));
    return type;
  }
  
  async createMaintenanceType(type: InsertMaintenanceType): Promise<MaintenanceType> {
    const [newType] = await db.insert(maintenanceTypes).values(type).returning();
    return newType;
  }
  
  async updateMaintenanceType(id: number, type: Partial<InsertMaintenanceType>): Promise<MaintenanceType | undefined> {
    const [updatedType] = await db.update(maintenanceTypes)
      .set(type)
      .where(eq(maintenanceTypes.id, id))
      .returning();
    return updatedType;
  }
  
  async deleteMaintenanceType(id: number): Promise<boolean> {
    const result = await db.delete(maintenanceTypes).where(eq(maintenanceTypes.id, id));
    return result.rowCount > 0;
  }
  
  // Maintenance project methods
  async getMaintenanceProjects(): Promise<MaintenanceProject[]> {
    return await db.select().from(maintenanceProjects);
  }

  async getMaintenanceProjectsByTenants(tenantIds: number[]): Promise<MaintenanceProject[]> {
    if (tenantIds.length === 0) {
      return [];
    }
    
    // Use SQL IN clause to get projects for multiple tenants
    const query = `
      SELECT * FROM maintenance_projects 
      WHERE tenant_id = ANY($1)
      ORDER BY created_at DESC
    `;
    
    const result = await this.pool.query(query, [tenantIds]);
    return result.rows;
  }
  
  async getMaintenanceProject(id: number): Promise<MaintenanceProject | undefined> {
    const [project] = await db.select().from(maintenanceProjects).where(eq(maintenanceProjects.id, id));
    return project;
  }
  
  async createMaintenanceProject(project: InsertMaintenanceProject): Promise<MaintenanceProject> {
    const [newProject] = await db.insert(maintenanceProjects).values({
      ...project,
      createdAt: new Date()
    }).returning();
    return newProject;
  }
  
  async updateMaintenanceProject(id: number, project: Partial<InsertMaintenanceProject>): Promise<MaintenanceProject | undefined> {
    const [updatedProject] = await db.update(maintenanceProjects)
      .set(project)
      .where(eq(maintenanceProjects.id, id))
      .returning();
    return updatedProject;
  }
  
  async deleteMaintenanceProject(id: number): Promise<boolean> {
    const result = await db.delete(maintenanceProjects).where(eq(maintenanceProjects.id, id));
    return result.rowCount > 0;
  }
  
  // Policy methods
  async getPolicies(): Promise<Policy[]> {
    return await db.select().from(policies);
  }
  
  async getPolicy(id: number): Promise<Policy | undefined> {
    const [policy] = await db.select().from(policies).where(eq(policies.id, id));
    return policy;
  }
  
  async createPolicy(policy: InsertPolicy): Promise<Policy> {
    const now = new Date();
    const [newPolicy] = await db.insert(policies).values({
      ...policy,
      createdAt: now,
      updatedAt: now
    }).returning();
    return newPolicy;
  }
  
  async updatePolicy(id: number, policy: Partial<InsertPolicy>): Promise<Policy | undefined> {
    const [updatedPolicy] = await db.update(policies)
      .set({
        ...policy,
        updatedAt: new Date()
      })
      .where(eq(policies.id, id))
      .returning();
    return updatedPolicy;
  }
  
  async deletePolicy(id: number): Promise<boolean> {
    const result = await db.delete(policies).where(eq(policies.id, id));
    return result.rowCount > 0;
  }
  
  // Budget allocation methods
  async getBudgetAllocations(): Promise<BudgetAllocation[]> {
    return await db.select().from(budgetAllocations);
  }
  
  async getBudgetAllocation(id: number): Promise<BudgetAllocation | undefined> {
    const [budget] = await db.select().from(budgetAllocations).where(eq(budgetAllocations.id, id));
    return budget;
  }
  
  async getActiveBudgetAllocation(): Promise<BudgetAllocation | undefined> {
    const [budget] = await db.select().from(budgetAllocations).where(eq(budgetAllocations.active, "true"));
    return budget;
  }
  
  async createBudgetAllocation(budget: InsertBudgetAllocation): Promise<BudgetAllocation> {
    const [newBudget] = await db.insert(budgetAllocations).values({
      ...budget,
      createdAt: new Date()
    }).returning();
    return newBudget;
  }
  
  async updateBudgetAllocation(id: number, budget: Partial<InsertBudgetAllocation>): Promise<BudgetAllocation | undefined> {
    const [updatedBudget] = await db.update(budgetAllocations)
      .set(budget)
      .where(eq(budgetAllocations.id, id))
      .returning();
    return updatedBudget;
  }
  
  async setBudgetAllocationActive(id: number): Promise<BudgetAllocation | undefined> {
    // First, set all allocations to inactive
    await db.update(budgetAllocations).set({ active: "false" });
    
    // Then set the specified one to active
    const [activeBudget] = await db.update(budgetAllocations)
      .set({ active: "true" })
      .where(eq(budgetAllocations.id, id))
      .returning();
    
    return activeBudget;
  }
  
  async deleteBudgetAllocation(id: number): Promise<boolean> {
    const result = await db.delete(budgetAllocations).where(eq(budgetAllocations.id, id));
    return result.rowCount > 0;
  }
  
  // Moisture reading methods
  async getMoistureReadings(roadAssetId: number): Promise<MoistureReading[]> {
    return await db
      .select()
      .from(moistureReadings)
      .where(eq(moistureReadings.roadAssetId, roadAssetId))
      .orderBy(desc(moistureReadings.readingDate));
  }

  // Get only the latest moisture reading per coordinate (optimized for map view with spatial filtering)
  async getLatestMoistureReadings(bounds?: string): Promise<Record<string, MoistureReading>> {
    // Use proper Drizzle ORM with raw SQL for PostgreSQL DISTINCT ON
    // This query should be very fast with proper indexing
    let query = `
      SELECT DISTINCT ON (latitude, longitude) 
        id, road_asset_id, latitude, longitude, moisture_value, reading_date, created_at
      FROM moisture_readings 
    `;
    
    const params: any[] = [];
    
    // Add spatial filtering if bounds are provided
    if (bounds) {
      try {
        const [minLng, minLat, maxLng, maxLat] = bounds.split(',').map(Number);
        query += ` WHERE latitude BETWEEN $1 AND $2 AND longitude BETWEEN $3 AND $4`;
        params.push(minLat, maxLat, minLng, maxLng);
      } catch (error) {
        console.error("Invalid bounds format:", bounds);
      }
    }
    
    query += ` ORDER BY latitude, longitude, created_at DESC`;
    
    const result = await pool.query(query, params);
    
    const latestReadings: Record<string, MoistureReading> = {};
    
    for (const row of result.rows) {
      const coordinateKey = `${row.latitude},${row.longitude}`;
      latestReadings[coordinateKey] = {
        id: row.id as number,
        roadAssetId: row.road_asset_id as number,
        latitude: row.latitude as number,
        longitude: row.longitude as number,
        moistureValue: row.moisture_value as number,
        readingDate: new Date(row.reading_date as string),
        createdAt: new Date(row.created_at as string)
      };
    }
    
    return latestReadings;
  }

  async getMoistureReading(id: number): Promise<MoistureReading | undefined> {
    const [reading] = await db
      .select()
      .from(moistureReadings)
      .where(eq(moistureReadings.id, id));
    return reading;
  }

  async createMoistureReading(reading: InsertMoistureReading): Promise<MoistureReading> {
    const [newReading] = await db
      .insert(moistureReadings)
      .values(reading)
      .returning();
    return newReading;
  }

  async updateMoistureReading(id: number, reading: Partial<InsertMoistureReading>): Promise<MoistureReading | undefined> {
    const [updatedReading] = await db
      .update(moistureReadings)
      .set(reading)
      .where(eq(moistureReadings.id, id))
      .returning();
    return updatedReading;
  }

  async deleteMoistureReading(id: number): Promise<boolean> {
    const result = await db
      .delete(moistureReadings)
      .where(eq(moistureReadings.id, id));
    return result.rowCount > 0;
  }

  async deleteMoistureReadingsByRoadAsset(roadAssetId: number): Promise<boolean> {
    const result = await db
      .delete(moistureReadings)
      .where(eq(moistureReadings.roadAssetId, roadAssetId));
    return result.rowCount > 0;
  }

  // Audit log methods
  async getAuditLogs(): Promise<AuditLog[]> {
    return await db.select().from(auditLogs).orderBy(desc(auditLogs.timestamp));
  }
  
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [newLog] = await db.insert(auditLogs).values({
      ...log,
      timestamp: new Date()
    }).returning();
    return newLog;
  }

  // Asset Type methods
  async getAssetTypes(): Promise<AssetType[]> {
    return await db.select().from(assetTypes);
  }

  async getAssetType(id: number): Promise<AssetType | undefined> {
    const [assetType] = await db.select().from(assetTypes).where(eq(assetTypes.id, id));
    return assetType;
  }

  async createAssetType(type: InsertAssetType): Promise<AssetType> {
    const now = new Date();
    const [newType] = await db.insert(assetTypes).values({
      ...type,
      createdAt: now,
      updatedAt: now
    }).returning();
    return newType;
  }

  async updateAssetType(id: number, type: Partial<InsertAssetType>): Promise<AssetType | undefined> {
    const [updatedType] = await db.update(assetTypes)
      .set({
        ...type,
        updatedAt: new Date()
      })
      .where(eq(assetTypes.id, id))
      .returning();
    return updatedType;
  }

  async deleteAssetType(id: number): Promise<boolean> {
    const result = await db.delete(assetTypes).where(eq(assetTypes.id, id));
    return result.rowCount > 0;
  }

  // Roadway Asset methods
  async getRoadwayAssets(tenantId?: number): Promise<RoadwayAsset[]> {
    if (tenantId) {
      try {
        // Get assets explicitly associated with the tenant via the join table
        const result1 = await db.select({
          roadwayAsset: roadwayAssets
        })
        .from(tenantRoadwayAssets)
        .innerJoin(roadwayAssets, eq(tenantRoadwayAssets.roadwayAssetId, roadwayAssets.id))
        .where(eq(tenantRoadwayAssets.tenantId, tenantId));
      
        // Get assets that have the tenantId property set directly
        const result2 = await db.select()
          .from(roadwayAssets)
          .where(eq(roadwayAssets.tenantId, tenantId));
        
        // Combine the results and remove duplicates by using a Map with asset ID as key
        const combinedAssets = new Map<number, RoadwayAsset>();
        
        // Add assets from the explicit tenant associations
        for (const record of result1) {
          combinedAssets.set(record.roadwayAsset.id, record.roadwayAsset);
        }
        
        // Add assets with the direct tenantId set
        for (const asset of result2) {
          combinedAssets.set(asset.id, asset);
        }
        
        // Convert map values to array
        return Array.from(combinedAssets.values());
      } catch (error) {
        console.error(`Error getting tenant roadway assets for tenant ${tenantId}:`, error);
        // Fallback to direct tenantId filtering if the join fails
        return await db.select()
          .from(roadwayAssets)
          .where(eq(roadwayAssets.tenantId, tenantId));
      }
    } else {
      // When no tenantId is provided (system admin view), return all roadway assets
      // but log a warning as this should generally not happen in production
      console.warn("Warning: Retrieving all roadway assets without tenant filtering");
      return await db.select().from(roadwayAssets);
    }
  }

  async getRoadwayAssetsByType(assetTypeId: number, tenantId?: number): Promise<RoadwayAsset[]> {
    try {
      // If no tenant filter, just filter by asset type
      if (!tenantId) {
        console.warn(`Warning: Retrieving all roadway assets of type ${assetTypeId} without tenant filtering`);
        return await db.select()
          .from(roadwayAssets)
          .where(eq(roadwayAssets.assetTypeId, assetTypeId));
      }
      
      // If tenantId is provided, filter by both asset type and tenant
      try {
        // First get all roadway assets filtered by tenant (using our established logic)
        const tenantFilteredAssets = await this.getRoadwayAssets(tenantId);
        
        // Then filter those assets by type
        return tenantFilteredAssets.filter(asset => asset.assetTypeId === assetTypeId);
      } catch (error) {
        console.error(`Error getting tenant roadway assets for tenant ${tenantId} and type ${assetTypeId}:`, error);
        
        // Fallback to direct filtering if the approach above fails
        // First try to get all assets explicitly associated with the tenant via the join table
        const result1 = await db.select({
          roadwayAsset: roadwayAssets
        })
        .from(tenantRoadwayAssets)
        .innerJoin(roadwayAssets, eq(tenantRoadwayAssets.roadwayAssetId, roadwayAssets.id))
        .where(
          and(
            eq(tenantRoadwayAssets.tenantId, tenantId),
            eq(roadwayAssets.assetTypeId, assetTypeId)
          )
        );
        
        // Then get all assets that have the tenantId property set directly
        const result2 = await db.select()
          .from(roadwayAssets)
          .where(
            and(
              eq(roadwayAssets.tenantId, tenantId),
              eq(roadwayAssets.assetTypeId, assetTypeId)
            )
          );
        
        // Combine the results and remove duplicates by using a Map with asset ID as key
        const combinedAssets = new Map<number, RoadwayAsset>();
        
        // Add assets from the explicit tenant associations
        for (const record of result1) {
          combinedAssets.set(record.roadwayAsset.id, record.roadwayAsset);
        }
        
        // Add assets with the direct tenantId set
        for (const asset of result2) {
          combinedAssets.set(asset.id, asset);
        }
        
        // Convert map values to array
        return Array.from(combinedAssets.values());
      }
    } catch (error) {
      console.error("Error in getRoadwayAssetsByType:", error);
      // Return empty array as fallback
      return [];
    }
  }

  async getRoadwayAsset(id: number, tenantId?: number): Promise<RoadwayAsset | undefined> {
    try {
      // First get the basic asset
      const [asset] = await db.select().from(roadwayAssets).where(eq(roadwayAssets.id, id));
      if (!asset) return undefined;
      
      // If no tenant filter, just return the asset (system admin view)
      if (!tenantId) {
        console.warn(`Warning: Retrieving roadway asset ID ${id} without tenant filtering`);
        return asset;
      }
      
      // Check if the asset belongs to this tenant directly
      if (asset.tenantId === tenantId) {
        return asset;
      }
      
      // Check if the asset is explicitly associated with this tenant
      const tenantAssociation = await db.select()
        .from(tenantRoadwayAssets)
        .where(
          and(
            eq(tenantRoadwayAssets.roadwayAssetId, id),
            eq(tenantRoadwayAssets.tenantId, tenantId)
          )
        );
      
      if (tenantAssociation.length > 0) {
        return asset;
      }
      
      // For assets with no explicit tenant ID, check if they're explicitly 
      // associated with any tenant
      if (asset.tenantId === null) {
        // Check if this asset is associated with any tenant explicitly
        const allAssociations = await db.select()
          .from(tenantRoadwayAssets)
          .where(eq(tenantRoadwayAssets.roadwayAssetId, id));
        
        // If not associated with any tenant, it's available for all
        if (allAssociations.length === 0) {
          return asset;
        }
      }
      
      // Asset is not accessible to this tenant
      return undefined;
    } catch (error) {
      console.error(`Error getting roadway asset ${id} for tenant ${tenantId}:`, error);
      // For critical errors, we might choose to log and return undefined rather than expose errors
      return undefined;
    }
  }

  async createRoadwayAsset(asset: InsertRoadwayAsset): Promise<RoadwayAsset> {
    const now = new Date();
    const [newAsset] = await db.insert(roadwayAssets).values({
      ...asset,
      createdAt: now,
      updatedAt: now
    }).returning();
    return newAsset;
  }

  async updateRoadwayAsset(id: number, asset: Partial<InsertRoadwayAsset>): Promise<RoadwayAsset | undefined> {
    const [updatedAsset] = await db.update(roadwayAssets)
      .set({
        ...asset,
        updatedAt: new Date()
      })
      .where(eq(roadwayAssets.id, id))
      .returning();
    return updatedAsset;
  }

  async deleteRoadwayAsset(id: number): Promise<boolean> {
    const result = await db.delete(roadwayAssets).where(eq(roadwayAssets.id, id));
    return result.rowCount > 0;
  }

  // Asset Inspection methods
  async getAssetInspections(): Promise<AssetInspection[]> {
    return await db.select().from(assetInspections);
  }

  async getAssetInspectionsByAssetId(roadwayAssetId: number): Promise<AssetInspection[]> {
    return await db.select()
      .from(assetInspections)
      .where(eq(assetInspections.roadwayAssetId, roadwayAssetId))
      .orderBy(desc(assetInspections.inspectionDate));
  }

  async getAssetInspection(id: number): Promise<AssetInspection | undefined> {
    const [inspection] = await db.select().from(assetInspections).where(eq(assetInspections.id, id));
    return inspection;
  }

  async createAssetInspection(inspection: InsertAssetInspection): Promise<AssetInspection> {
    const [newInspection] = await db.insert(assetInspections).values({
      ...inspection,
      createdAt: new Date()
    }).returning();
    return newInspection;
  }

  async updateAssetInspection(id: number, inspection: Partial<InsertAssetInspection>): Promise<AssetInspection | undefined> {
    const [updatedInspection] = await db.update(assetInspections)
      .set(inspection)
      .where(eq(assetInspections.id, id))
      .returning();
    return updatedInspection;
  }

  async deleteAssetInspection(id: number): Promise<boolean> {
    const result = await db.delete(assetInspections).where(eq(assetInspections.id, id));
    return result.rowCount > 0;
  }

  // Asset Maintenance Record methods
  async getAssetMaintenanceRecords(): Promise<AssetMaintenanceRecord[]> {
    return await db.select().from(assetMaintenanceRecords);
  }

  async getAssetMaintenanceRecordsByAssetId(roadwayAssetId: number): Promise<AssetMaintenanceRecord[]> {
    return await db.select()
      .from(assetMaintenanceRecords)
      .where(eq(assetMaintenanceRecords.roadwayAssetId, roadwayAssetId))
      .orderBy(desc(assetMaintenanceRecords.maintenanceDate));
  }

  async getAssetMaintenanceRecord(id: number): Promise<AssetMaintenanceRecord | undefined> {
    const [record] = await db.select().from(assetMaintenanceRecords).where(eq(assetMaintenanceRecords.id, id));
    return record;
  }

  async createAssetMaintenanceRecord(record: InsertAssetMaintenanceRecord): Promise<AssetMaintenanceRecord> {
    const [newRecord] = await db.insert(assetMaintenanceRecords).values({
      ...record,
      createdAt: new Date()
    }).returning();
    return newRecord;
  }

  async updateAssetMaintenanceRecord(id: number, record: Partial<InsertAssetMaintenanceRecord>): Promise<AssetMaintenanceRecord | undefined> {
    const [updatedRecord] = await db.update(assetMaintenanceRecords)
      .set(record)
      .where(eq(assetMaintenanceRecords.id, id))
      .returning();
    return updatedRecord;
  }

  async deleteAssetMaintenanceRecord(id: number): Promise<boolean> {
    const result = await db.delete(assetMaintenanceRecords).where(eq(assetMaintenanceRecords.id, id));
    return result.rowCount > 0;
  }

  // Tenant - Asset Association Methods
  async associateRoadwayAssetWithTenant(roadwayAssetId: number, tenantId: number): Promise<boolean> {
    try {
      // Check if the association already exists
      const existing = await db.select()
        .from(tenantRoadwayAssets)
        .where(
          and(
            eq(tenantRoadwayAssets.roadwayAssetId, roadwayAssetId),
            eq(tenantRoadwayAssets.tenantId, tenantId)
          )
        );
      
      if (existing.length > 0) {
        // Association already exists
        return true;
      }
      
      // Create the association
      await db.insert(tenantRoadwayAssets).values({
        roadwayAssetId,
        tenantId,
        createdAt: new Date()
      });
      
      return true;
    } catch (error) {
      console.error("Error associating roadway asset with tenant:", error);
      return false;
    }
  }
  
  async removeRoadwayAssetFromTenant(roadwayAssetId: number, tenantId: number): Promise<boolean> {
    try {
      const result = await db.delete(tenantRoadwayAssets)
        .where(
          and(
            eq(tenantRoadwayAssets.roadwayAssetId, roadwayAssetId),
            eq(tenantRoadwayAssets.tenantId, tenantId)
          )
        );
      
      return result.rowCount > 0;
    } catch (error) {
      console.error("Error removing roadway asset from tenant:", error);
      return false;
    }
  }
  
  async getRoadwayAssetTenants(roadwayAssetId: number): Promise<Tenant[]> {
    try {
      const result = await db.select({
        tenant: tenants
      })
      .from(tenantRoadwayAssets)
      .innerJoin(tenants, eq(tenantRoadwayAssets.tenantId, tenants.id))
      .where(eq(tenantRoadwayAssets.roadwayAssetId, roadwayAssetId));
      
      return result.map(r => r.tenant);
    } catch (error) {
      console.error("Error getting roadway asset tenants:", error);
      return [];
    }
  }
}

// Export a database storage instance
export const storage = new DatabaseStorage();