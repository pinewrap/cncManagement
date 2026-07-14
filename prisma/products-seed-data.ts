// CNC Grease & Lubricants' real, fixed product catalog.
// This is the single source of truth for what the client can choose from —
// there is no "add product" form in the app. To add/change a product line,
// edit this file and re-run: npx prisma db seed (safe to re-run anytime,
// it upserts by sku).
export const products = [
  // 1. Eligate Red Gel
  { sku: "ELIGATE-RED-DRUM-181.4KG", name: "Eligate Red Gel", variant: null, packageType: "Drum", packageSize: 181.4, unit: "kg" },
  { sku: "ELIGATE-RED-KEG-50KG", name: "Eligate Red Gel", variant: null, packageType: "Keg", packageSize: 50, unit: "kg" },
  { sku: "ELIGATE-RED-PAIL-16KG", name: "Eligate Red Gel", variant: null, packageType: "Pail", packageSize: 16, unit: "kg" },
  { sku: "ELIGATE-RED-TUB-2KG", name: "Eligate Red Gel", variant: null, packageType: "Tub", packageSize: 2, unit: "kg" },
  { sku: "ELIGATE-RED-TUB-500G", name: "Eligate Red Gel", variant: null, packageType: "Tub", packageSize: 0.5, unit: "kg" },
  { sku: "ELIGATE-RED-TUBE-400G", name: "Eligate Red Gel", variant: null, packageType: "Tube", packageSize: 0.4, unit: "kg" },
  { sku: "ELIGATE-RED-POUCH-200G", name: "Eligate Red Gel", variant: null, packageType: "Pouch", packageSize: 0.2, unit: "kg" },

  // 2. Ocean Blue Gel
  { sku: "OCEAN-BLUE-PAIL-16KG", name: "Ocean Blue Gel", variant: null, packageType: "Pail", packageSize: 16, unit: "kg" },
  { sku: "OCEAN-BLUE-TUBE-400G", name: "Ocean Blue Gel", variant: null, packageType: "Tube", packageSize: 0.4, unit: "kg" },

  // 3. Automatic Grease Hector — EP"0" and EP"00"
  { sku: "HECTOR-EP0-KEG-50KG", name: "Automatic Grease Hector", variant: "EP0", packageType: "Keg", packageSize: 50, unit: "kg" },
  { sku: "HECTOR-EP0-PAIL-16KG", name: "Automatic Grease Hector", variant: "EP0", packageType: "Pail", packageSize: 16, unit: "kg" },
  { sku: "HECTOR-EP0-TUBE-400G", name: "Automatic Grease Hector", variant: "EP0", packageType: "Tube", packageSize: 0.4, unit: "kg" },
  { sku: "HECTOR-EP00-KEG-50KG", name: "Automatic Grease Hector", variant: "EP00", packageType: "Keg", packageSize: 50, unit: "kg" },
  { sku: "HECTOR-EP00-PAIL-16KG", name: "Automatic Grease Hector", variant: "EP00", packageType: "Pail", packageSize: 16, unit: "kg" },
  { sku: "HECTOR-EP00-TUBE-400G", name: "Automatic Grease Hector", variant: "EP00", packageType: "Tube", packageSize: 0.4, unit: "kg" },

  // 4. Synth 75W90 Gear Oil
  { sku: "GEAR-75W90-DRUM-208L", name: "Gear Oil", variant: "Synth 75W90", packageType: "Drum", packageSize: 208, unit: "L" },
  { sku: "GEAR-75W90-KEG-60L", name: "Gear Oil", variant: "Synth 75W90", packageType: "Keg", packageSize: 60, unit: "L" },
  { sku: "GEAR-75W90-PAIL-19L", name: "Gear Oil", variant: "Synth 75W90", packageType: "Pail", packageSize: 19, unit: "L" },
  { sku: "GEAR-75W90-JUG-5L", name: "Gear Oil", variant: "Synth 75W90", packageType: "Jug", packageSize: 5, unit: "L" },

  // 5. Synth 80W90 Gear Oil
  { sku: "GEAR-80W90-DRUM-208L", name: "Gear Oil", variant: "Synth 80W90", packageType: "Drum", packageSize: 208, unit: "L" },
  { sku: "GEAR-80W90-KEG-60L", name: "Gear Oil", variant: "Synth 80W90", packageType: "Keg", packageSize: 60, unit: "L" },
  { sku: "GEAR-80W90-PAIL-19L", name: "Gear Oil", variant: "Synth 80W90", packageType: "Pail", packageSize: 19, unit: "L" },
  { sku: "GEAR-80W90-JUG-5L", name: "Gear Oil", variant: "Synth 80W90", packageType: "Jug", packageSize: 5, unit: "L" },
  { sku: "GEAR-80W90-JUG-1L", name: "Gear Oil", variant: "Synth 80W90", packageType: "Jug", packageSize: 1, unit: "L" },

  // 6. ATF DIII Steering Fluid
  { sku: "ATF-D3-PAIL-19L", name: "ATF Steering Fluid", variant: "DIII", packageType: "Pail", packageSize: 19, unit: "L" },
  { sku: "ATF-D3-JUG-5L", name: "ATF Steering Fluid", variant: "DIII", packageType: "Jug", packageSize: 5, unit: "L" },
  { sku: "ATF-D3-JUG-1L", name: "ATF Steering Fluid", variant: "DIII", packageType: "Jug", packageSize: 1, unit: "L" },

  // 7. Red Coolant 50/50
  { sku: "COOLANT-RED-JUG-3.78L", name: "Coolant", variant: "Red 50/50", packageType: "Jug", packageSize: 3.78, unit: "L" },
  { sku: "COOLANT-RED-TOTE-1000L", name: "Coolant", variant: "Red 50/50", packageType: "Tote", packageSize: 1000, unit: "L" },

  // 8. Winter Washer Fluid -40
  { sku: "WASHER-WINTER40-JUG-3.78L", name: "Washer Fluid", variant: "Winter -40", packageType: "Jug", packageSize: 3.78, unit: "L" },
  { sku: "WASHER-WINTER40-TOTE-1000L", name: "Washer Fluid", variant: "Winter -40", packageType: "Tote", packageSize: 1000, unit: "L" },
];
