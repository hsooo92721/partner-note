export type Temperature = "HOT" | "ICED";
export interface Step {
  order: number;
  action: string;
  description: string;
  ingredientId: string | null;
  equipment: string;
  quantityBySize: Record<string, number>;
  unit: string;
  note: string;
}
export interface Recipe {
  drinkId: string;
  temperature: string;
  size: string;
  orderedSteps: Step[];
  equipment: string;
  servingInstructions: string;
}
export interface Drink {
  id: string;
  name: string;
  englishName: string;
  markingCode: string;
  category: string;
  promotion: null | { status: string; notes: string; releases: unknown[] };
  availableTemperatures: string[];
  availableSizesByTemperature: Record<string, string[]>;
  nutritionBySize: Record<string, unknown>;
  allergens: string[];
  specialInstructions: string;
  relatedIngredientIds: string[];
  verificationStatus: string;
  source: string;
}
export interface Ingredient {
  noRuleStates?: string[];
  id: string;
  name: string;
  type: string;
  aliases: string[];
  relatedIngredientIds: string[];
  source: string;
  verificationStatus: string;
}
export interface Rule {
  id: string;
  ingredientId: string;
  workState: string;
  storageCondition: string;
  durationValue: number;
  durationUnit: string;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  verificationStatus: string;
  source: string;
  updatedAt: string;
  notes: string;
  tagType: string;
  dateFields: string[];
  dateFormat: string;
  numberCode: number | null;
  tagNotes: string;
}
export interface Database {
  version: number;
  drinks: Drink[];
  recipes: Recipe[];
  ingredients: Ingredient[];
  rules: Rule[];
}
