// A "Class" is a blueprint for creating objects.
// This is our blueprint for the entire calculator. It will hold the data and the calculation methods.
class SepticCalculator {
    
    // The constructor is a special method that runs automatically when we create a new calculator.
    // It's the perfect place to set up our initial properties.
    constructor() {
        // We initialize properties to hold our data once it's loaded.
        // Using 'null' means "no value yet".
        this.systemData = null;
        this.regionalData = null;
    }

    // --- DATA LOADING METHOD ---
    // We use an 'async' method because fetching files takes time. 'async' allows the
    // browser to do other things while it waits for the files to load.
    async loadData() {
        try {
            // 'await' pauses the execution of this function until the file is fetched.
            // 'fetch' is the modern JavaScript way to request files.
            // CORRECTED PATHS: The paths are relative to the index.html file.
            const systemResponse = await fetch('data/septic_systems.json');
            this.systemData = await systemResponse.json(); // Convert the response to JSON

            const regionalResponse = await fetch('data/regional_cost_data.json');
            this.regionalData = await regionalResponse.json(); // Convert the response to JSON

            console.log("Septic system and regional data loaded successfully.");

        } catch (error) {
            // If anything goes wrong (e.g., file not found, typo in the filename),
            // we'll see a clear error message in the browser's console.
            console.error("Failed to load calculator data:", error);
        }
    }

    // --- HELPER METHOD FOR REGIONAL DATA ---
    getRegionalAdjustment(zipCode) {
        // First, figure out the state from the zip code. This is a simplified but effective method.
        const stateMappings = {
            'AL': '35', 'AK': '99', 'AZ': '85', 'AR': '71', 'CA': '90', 'CO': '80', 'CT': '06',
            'DE': '19', 'FL': '32', 'GA': '30', 'HI': '96', 'ID': '83', 'IL': '60', 'IN': '46',
            'IA': '50', 'KS': '66', 'KY': '40', 'LA': '70', 'ME': '03', 'MD': '20', 'MA': '01',
            'MI': '48', 'MN': '55', 'MS': '38', 'MO': '63', 'MT': '59', 'NE': '68', 'NV': '88',
            'NH': '03', 'NJ': '07', 'NM': '87', 'NY': '10', 'NC': '27', 'ND': '58', 'OH': '43',
            'OK': '73', 'OR': '97', 'PA': '15', 'RI': '02', 'SC': '29', 'SD': '57', 'TN': '37',
            'TX': '75', 'UT': '84', 'VT': '05', 'VA': '22', 'WA': '98', 'WV': '24', 'WI': '53', 'WY': '82'
        };
        
        let stateCode = 'default';
        // Ensure zipCode is treated as a string for startsWith()
        const zipString = String(zipCode);
        for (const code in stateMappings) {
            if (zipString.startsWith(stateMappings[code])) {
                stateCode = code;
                break;
            }
        }

        const stateData = this.regionalData[stateCode] || this.regionalData['default'];
        let regionalMultiplier = stateData.base_multiplier;
        const permitFee = stateData.permitFee;

        // Now, check for more specific sub-regions within the state
        if (stateData.regions) {
            let regionFound = false;
            for (const range in stateData.regions) {
                if (range !== 'default') {
                    const [min, max] = range.split('-').map(Number);
                    if (zipCode >= min && zipCode <= max) {
                        regionalMultiplier *= stateData.regions[range];
                        regionFound = true;
                        break;
                    }
                }
            }
            if (!regionFound && stateData.regions.default) {
                regionalMultiplier *= stateData.regions.default;
            }
        }
        
        return { regionalMultiplier, permitFee };
    }


    // --- MASTER CALCULATION METHOD ---
    // This is the main engine. It takes the user's choices and returns the final cost.
    calculateInstallationCost(userInputs) {
        // 1. Get the selected system's base data from our loaded data.
        const system = this.systemData.installation[userInputs.systemType];

        // 2. Check for incompatibility.
        const soilMultiplier = system.soilMultiplier[userInputs.soilType];
        if (soilMultiplier === -1) {
            return {
                error: true,
                message: `A ${system.name} is not suitable for properties with "${userInputs.soilType}" soil. Please choose a different system, like a Mound or Aerobic system.`
            };
        }

        // 3. Get the multipliers based on user choices.
        const bedroomMultiplier = system.bedroomMultiplier[userInputs.bedrooms];

        // 4. Calculate the base cost after property-specific adjustments.
        let minCost = system.basePrice.min * bedroomMultiplier * soilMultiplier;
        let maxCost = system.basePrice.max * bedroomMultiplier * soilMultiplier;

        // 5. Apply regional adjustments using the new helper method.
        const { regionalMultiplier, permitFee } = this.getRegionalAdjustment(userInputs.zipCode);

        minCost = minCost * regionalMultiplier + permitFee.min;
        maxCost = maxCost * regionalMultiplier + permitFee.max;

        // 6. Return the final, structured result.
        return {
            error: false,
            minEstimate: Math.round(minCost / 100) * 100,
            maxEstimate: Math.round(maxCost / 100) * 100,
            // We now include a detailed object for the PDF generator
            quoteDetails: {
                userInput: userInputs,
                system: system,
                adjustments: {
                    bedroomMultiplier: bedroomMultiplier,
                    soilMultiplier: soilMultiplier,
                    regionalMultiplier: regionalMultiplier.toFixed(2)
                },
                permitFee: permitFee
            },
            message: "This is a preliminary estimate for budgeting purposes."
        };
    }
}