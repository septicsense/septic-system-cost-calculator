class SepticCalculator {
    constructor() {
        this.systemData = null;
        this.regionalData = null;
    }

    async loadData() {
        try {
            const systemResponse = await fetch('data/septic_systems.json');
            this.systemData = await systemResponse.json();
            const regionalResponse = await fetch('data/regional_cost_data.json');
            this.regionalData = await regionalResponse.json();
            console.log("Refined calculator data loaded successfully.");
        } catch (error) {
            console.error("Failed to load refined calculator data:", error);
        }
    }

    // === MASTER CALCULATION METHOD ===
    // This function acts as a router. It looks at the calculation type
    // and calls the appropriate private method.
    calculateCost(userInputs) {
        if (!this.systemData || !this.regionalData) {
            return { error: true, message: "Data not loaded. Please refresh." };
        }

        const calculationType = userInputs.calculationType;
        const regionalAdjustment = this._getRegionalAdjustment(userInputs.zipCode);

        switch (calculationType) {
            case 'installation':
                return this._calculateInstallationCost(userInputs, regionalAdjustment);
            case 'repair':
            case 'maintenance':
                return this._calculateSimpleCost(userInputs, regionalAdjustment);
            default:
                return { error: true, message: "Invalid calculation type." };
        }
    }

    // === "PRIVATE" METHOD FOR INSTALLATIONS ===
    _calculateInstallationCost(inputs, regional) {
        const system = this.systemData.installation[inputs.systemType];
        if (!system) return { error: true, message: "Selected system type not found." };
        
        // Check for incompatibility
        const soilMultiplier = system.soil_multiplier[inputs.soilType];
        if (soilMultiplier === -1) {
            return {
                error: true,
                message: `A ${system.name} is not suitable for properties with "${inputs.soilType}" soil. Consider a Mound or Aerobic system.`
            };
        }

        const gpdMultiplier = system.gpd_multiplier[inputs.waterUsage];
        const combinedMultiplier = soilMultiplier * gpdMultiplier * regional.regionalMultiplier;

        // Calculate each cost component individually
        const breakdown = {};
        let minTotal = 0;
        let maxTotal = 0;

        for (const component in system.cost_components) {
            const min = system.cost_components[component].min;
            const max = system.cost_components[component].max;

            const adjustedMin = min * combinedMultiplier;
            const adjustedMax = max * combinedMultiplier;

            breakdown[component] = { min: adjustedMin, max: adjustedMax };
            minTotal += adjustedMin;
            maxTotal += adjustedMax;
        }

        return {
            error: false,
            type: 'installation',
            systemName: system.name,
            minEstimate: Math.round((minTotal) / 100) * 100,
            maxEstimate: Math.round((maxTotal) / 100) * 100,
            breakdown: breakdown,
            userInput: inputs
        };
    }

    // === "PRIVATE" METHOD FOR REPAIR & MAINTENANCE ===
    _calculateSimpleCost(inputs, regional) {
        const type = inputs.calculationType; // 'repair' or 'maintenance'
        const jobKey = inputs.systemType; // In this context, systemType is the job key
        const job = this.systemData[type][jobKey];

        if (!job) return { error: true, message: "Selected job type not found." };

        const minTotal = job.basePrice.min * regional.regionalMultiplier;
        const maxTotal = job.basePrice.max * regional.regionalMultiplier;

        return {
            error: false,
            type: type,
            systemName: job.name,
            description: job.description,
            minEstimate: Math.round(minTotal / 50) * 50,
            maxEstimate: Math.round(maxTotal / 50) * 50,
            breakdown: null, // No breakdown for simple jobs
            userInput: inputs
        };
    }

    // === HELPER METHOD FOR REGIONAL DATA (Unchanged) ===
    _getRegionalAdjustment(zipCode) {
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
        const zipString = String(zipCode);
        for (const code in stateMappings) {
            if (zipString.startsWith(stateMappings[code])) {
                stateCode = code;
                break;
            }
        }

        const stateData = this.regionalData[stateCode] || this.regionalData['default'];
        let regionalMultiplier = stateData.base_multiplier;
        
        if (stateData.regions) {
            let regionFound = false;
            for (const range in stateData.regions) {
                if (range !== 'default') {
                    const [min, max] = range.split('-').map(Number);
                    if (zipString >= min && zipString <= max) {
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
        
        // Note: We are no longer returning permitFee from here as it's part of the component breakdown now.
        return { regionalMultiplier };
    }
}