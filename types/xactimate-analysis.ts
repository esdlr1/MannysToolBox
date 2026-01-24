// Xactimate Analysis Types - Migrated from TheClearScope

export interface XactimateLineItem {
  category: string;        // Flooring, Drywall, Paint, Electrical, Emergency Services, etc.
  title: string;           // "Remove damaged drywall, insulation, baseboards, and protect/move contents"
  description: string;     // Detailed description of the work to be performed
  damageCode: string;     // "WTR" (Water), "FR" (Fire), "STM" (Storm), "MUD" (Mud)
  laborType: string;      // "Demo", "Install", "Paint", "Repair", "Extract", "Clean", "Sanitize", "Prep", "Finish", "Prime", "Tape", "Mud", "Texture"
  materialGrade: string;  // "Standard", "Premium", "Economy"
  processCode?: string;   // "WTR EXTMS", "WTR DEBRS", "WTR AMB", "CNT MVMOVE", "PLS COV"
  notes?: string;         // Additional notes or specifications
  // PhotoXact additions
  code?: string;          // Xactimate code (e.g., "DRYW", "PLM")
  quantity?: number;      // Quantity
  unit?: string;          // Unit of measurement
  unitPrice?: number;     // Unit price
  totalPrice?: number;    // Total price
}

export interface RoomAnalysis {
  roomType: string;       // "Kitchen", "Living Room", "Bedroom", "Bathroom", etc.
  lineItems: XactimateLineItem[];
  damageCategory: string; // "Water Damage", "Fire Damage", "Storm Damage", etc.
  waterCategory?: string; // "Category 1", "Category 2", "Category 3" for water damage
  severityLevel?: string; // "Minor", "Moderate", "Major", "Severe"
  notes?: string;         // Additional room-specific notes
}

export interface XactimateAnalysis {
  rooms: RoomAnalysis[];
  overallDamageCategory: string; // Overall damage type across all rooms
  projectNotes?: string;         // Overall project notes
  createdAt: Date;
  mainReportContent?: string;    // The comprehensive Xactimate-style report content
}

// Helper functions
export function getAllLineItems(analysis: XactimateAnalysis): XactimateLineItem[] {
  return analysis.rooms.flatMap(room => room.lineItems);
}

export function getLineItemsByCategory(analysis: XactimateAnalysis, category: string): XactimateLineItem[] {
  return getAllLineItems(analysis).filter(item => item.category === category);
}

export function getLineItemsByDamageCode(analysis: XactimateAnalysis, damageCode: string): XactimateLineItem[] {
  return getAllLineItems(analysis).filter(item => item.damageCode === damageCode);
}

export function getLineItemsByLaborType(analysis: XactimateAnalysis, laborType: string): XactimateLineItem[] {
  return getAllLineItems(analysis).filter(item => item.laborType === laborType);
}

export function getAllCategories(analysis: XactimateAnalysis): string[] {
  const categories = new Set<string>();
  getAllLineItems(analysis).forEach(item => categories.add(item.category));
  return Array.from(categories).sort();
}

export function getAllDamageCodes(analysis: XactimateAnalysis): string[] {
  const codes = new Set<string>();
  getAllLineItems(analysis).forEach(item => codes.add(item.damageCode));
  return Array.from(codes).sort();
}

export function getAllLaborTypes(analysis: XactimateAnalysis): string[] {
  const types = new Set<string>();
  getAllLineItems(analysis).forEach(item => types.add(item.laborType));
  return Array.from(types).sort();
}

export function getSummary(analysis: XactimateAnalysis) {
  return {
    totalRooms: analysis.rooms.length,
    totalLineItems: getAllLineItems(analysis).length,
    categories: getAllCategories(analysis).length,
    damageCodes: getAllDamageCodes(analysis).length,
    laborTypes: getAllLaborTypes(analysis).length,
  };
}
