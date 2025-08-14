document.addEventListener('DOMContentLoaded', () => {

    // ===================================================================================
    // === 1. COST DATABASE & SYSTEM LOGIC (The Brains) ===
    // ===================================================================================
    // All costs are represented as [low_end, high_end] national averages.
    // The regional multiplier will adjust these.

    const COST_DATA = {
        regions: {
            rural: 0.85,    // 15% cheaper than average
            suburban: 1.0,  // The baseline average
            urban: 1.20,    // 20% more expensive
            metro: 1.40     // 40% more expensive
        },
        installation: {
            permitsAndDesign: [800, 2000],
            excavationAndLabor: {
                conventional: [2000, 5000],
                advanced: [4000, 8000] // For mound, ATU, etc.
            },
            tanks: {
                // [size] : { material: [low, high] }
                '1000': {
                    concrete: [1000, 1500],
                    plastic: [800, 1300],
                    fiberglass: [1500, 2200]
                },
                '1250': {
                    concrete: [1400, 2000],
                    plastic: [1200, 1800],
                    fiberglass: [2000, 2800]
                },
                '1500': {
                    concrete: [1800, 2500],
                    plastic: [1600, 2400],
                    fiberglass: [2500, 3500]
                }
            },
            drainfield: {
                // Per bedroom costs
                conventional: [1500, 3000], // e.g., gravity, chamber
                mound: [4000, 7000],          // Much higher due to sand and labor
                drip: [3500, 6000],           // Special tubing and installation
                atu: [2500, 4500]             // Drainfield for an ATU is often smaller
            },
            advancedSystemUnits: {
                // Additional cost for the unit itself
                moundFill: [3000, 5000], // Cost for the special sand fill
                atu: [6000, 12000]       // The Aerobic Treatment Unit itself
            }
        },
        repair: {
            lid: [200, 500],
            baffle: [300, 900],
            pump: [800, 2500],
            dbox: [500, 1500]
        },
        maintenance: {
            // Per 1000 gallons
            pumping: [300, 600],
            inspection: [250, 500]
        }
    };

    const SYSTEM_LOGIC = {
        // Defines which systems are available for which soil type
        good: ['conventional-gravity', 'conventional-chamber'],
        average: ['conventional-gravity', 'conventional-chamber', 'conventional-pump'],
        poor: ['mound', 'atu-aerobic'],
        vpoor: ['atu-aerobic', 'drip-distribution']
    };

    const SYSTEM_NAMES = {
        'conventional-gravity': 'Conventional Gravity System',
        'conventional-chamber': 'Conventional Chamber System',
        'conventional-pump': 'Conventional Pump System',
        'mound': 'Mound System',
        'atu-aerobic': 'Aerobic Treatment Unit (ATU)',
        'drip-distribution': 'Drip Distribution System'
    };

    // ===================================================================================
    // === 2. DOM ELEMENT SELECTORS ===
    // ===================================================================================

    const form = document.getElementById('septic-calculator-form');
    
    // Panels and Stepper
    const panels = {
        1: document.getElementById('panel-1'),
        2: document.getElementById('panel-2')
    };
    const steps = {
        1: document.getElementById('step-1'),
        2: document.getElementById('step-2'),
        3: document.getElementById('step-3')
    }
    const panel2Title = document.getElementById('panel-2-title');

    // Panel 1 Inputs
    const selectionCards = document.querySelectorAll('.selection-card');

    // Panel 2 Inputs (shared)
    const regionSelect = document.getElementById('region');

    // Panel 2 Question Groups
    const questionGroups = {
        installation: document.getElementById('installation-questions'),
        repair: document.getElementById('repair-questions'),
        maintenance: document.getElementById('maintenance-questions')
    };

    // Installation Specific Inputs
    const soilTypeSelect = document.getElementById('soil-type');
    const systemTypeSelect = document.getElementById('system-type');
    const bedroomsSelect = document.getElementById('bedrooms');
    const tankMaterialSelect = document.getElementById('tank-material');
    
    // Repair Specific Inputs
    const repairCheckboxes = document.querySelectorAll('input[name="repair-item"]');
    
    // Maintenance Specific Inputs
    const tankSizeSelect = document.getElementById('tank-size');
    
    // Navigation Buttons
    const backBtn2 = document.getElementById('back-btn-2');
    const calculateBtn = document.getElementById('calculate-btn');
    const startOverBtn = document.getElementById('start-over-btn');
    
    // Results Display
    const resultsPlaceholder = document.getElementById('results-placeholder');
    const resultsOutput = document.getElementById('results-output');
    const resultsSummaryText = document.getElementById('results-summary-text');
    const resultsRange = document.getElementById('results-range');
    const resultsBreakdown = document.getElementById('results-breakdown');
    const resultsNotes = document.getElementById('results-notes');

    // To hold the current state of the calculator
    let currentState = {
        workType: null, // 'installation', 'repair', 'maintenance'
        currentPanel: 1
    };

    // ===================================================================================
    // === 3. UI CONTROLLER & EVENT HANDLERS ===
    // ===================================================================================

    function init() {
        // --- Event Listeners ---
        selectionCards.forEach(card => {
            card.addEventListener('click', handleWorkTypeSelection);
        });
        
        soilTypeSelect.addEventListener('change', updateSystemTypeOptions);

        backBtn2.addEventListener('click', () => goToPanel(1));
        
        form.addEventListener('submit', handleFormSubmit);

        startOverBtn.addEventListener('click', resetCalculator);
    }
    
    function handleWorkTypeSelection(e) {
        const selectedCard = e.currentTarget;
        currentState.workType = selectedCard.dataset.workType;

        // Visual selection indicator
        selectionCards.forEach(card => card.classList.remove('selected'));
        selectedCard.classList.add('selected');
        
        // Update UI for the selected work type
        updateFormForWorkType(currentState.workType);
        
        // Move to the next panel
        setTimeout(() => goToPanel(2), 300); // Small delay for user to see selection
    }
    
    function updateFormForWorkType(workType) {
        // Hide all question groups first
        Object.values(questionGroups).forEach(group => group.classList.add('hidden'));

        // Show the relevant group
        if (questionGroups[workType]) {
            questionGroups[workType].classList.remove('hidden');
        }
        
        // Update panel title
        const titles = {
            installation: 'New Installation Profile',
            repair: 'Repair Details',
            maintenance: 'Maintenance Details'
        };
        panel2Title.textContent = titles[workType] || 'Please provide details';
    }

    function updateSystemTypeOptions() {
        const soilType = soilTypeSelect.value;
        const availableSystems = SYSTEM_LOGIC[soilType] || [];
        
        systemTypeSelect.innerHTML = ''; // Clear existing options
        
        if (availableSystems.length === 0) {
            systemTypeSelect.innerHTML = '<option value="" disabled selected>Select soil type first...</option>';
            return;
        }

        availableSystems.forEach(systemKey => {
            const option = document.createElement('option');
            option.value = systemKey;
            option.textContent = SYSTEM_NAMES[systemKey];
            systemTypeSelect.appendChild(option);
        });
    }

    function goToPanel(panelNumber) {
        currentState.currentPanel = panelNumber;
        
        // Hide all panels
        Object.values(panels).forEach(panel => panel.classList.remove('active'));
        // Show the target panel
        if(panels[panelNumber]) panels[panelNumber].classList.add('active');

        // Update stepper
        Object.values(steps).forEach(step => step.classList.remove('active'));
        if(steps[panelNumber]) steps[panelNumber].classList.add('active');
        if (panelNumber > 1) steps[1].classList.add('active'); // Keep previous steps active
    }

    function handleFormSubmit(e) {
        e.preventDefault(); // Stop form from actually submitting
        const results = calculateEstimate();
        if (results) {
            displayResults(results);
            goToResults();
        }
    }

    function goToResults() {
        // Activate the final step in the stepper
        steps[3].classList.add('active');
        // Hide the form and show the results
        form.classList.add('hidden');
        resultsPlaceholder.classList.add('hidden');
        resultsOutput.classList.remove('hidden');
    }
    
    function displayResults(results) {
        // Format numbers as currency
        const formatCurrency = (num) => `$${Math.round(num).toLocaleString()}`;
        
        resultsSummaryText.textContent = results.title;
        resultsRange.textContent = `${formatCurrency(results.range[0])} - ${formatCurrency(results.range[1])}`;

        resultsBreakdown.innerHTML = results.breakdown.map(item => `
            <div class="breakdown-item">
                <span class="label">${item.label}</span>
                <span class="value">${item.value}</span>
            </div>
        `).join('');

        resultsNotes.innerHTML = results.notes.map(note => `<p>${note}</p>`).join('');
    }

    function resetCalculator() {
        currentState.workType = null;
        form.reset();
        
        selectionCards.forEach(card => card.classList.remove('selected'));

        resultsOutput.classList.add('hidden');
        resultsPlaceholder.classList.remove('hidden');
        form.classList.remove('hidden');

        goToPanel(1);
        steps[2].classList.remove('active');
        steps[3].classList.remove('active');
    }


    // ===================================================================================
    // === 4. CALCULATION ENGINE ===
    // ===================================================================================

    function calculateEstimate() {
        if (!currentState.workType) return null;

        switch (currentState.workType) {
            case 'installation': return calculateInstallationCost();
            case 'repair': return calculateRepairCost();
            case 'maintenance': return calculateMaintenanceCost();
            default: return null;
        }
    }
    
    function calculateInstallationCost() {
        const region = regionSelect.value;
        const multiplier = COST_DATA.regions[region] || 1.0;
        
        const bedrooms = bedroomsSelect.value;
        const soil = soilTypeSelect.value;
        const system = systemTypeSelect.value;
        const material = tankMaterialSelect.value;

        // Determine tank size
        let tankSize = '1000';
        if (bedrooms === '4' || bedrooms === '5') tankSize = '1250';
        if (bedrooms === '6+') tankSize = '1500';

        // Get bedroom count for drainfield calc
        const bedroomCount = bedrooms === '6+' ? 6 : parseInt(bedrooms.charAt(0));

        let low = 0, high = 0;
        const breakdown = [];
        const notes = [];

        // 1. Permits & Design
        const [pLow, pHigh] = COST_DATA.installation.permitsAndDesign;
        low += pLow; high += pHigh;
        breakdown.push({ label: 'Permits & Design', value: `$${pLow} - $${pHigh}` });

        // 2. Septic Tank
        const tankCosts = COST_DATA.installation.tanks[tankSize][material];
        const [tLow, tHigh] = tankCosts;
        low += tLow; high += tHigh;
        breakdown.push({ label: `${tankSize}g ${material.charAt(0).toUpperCase() + material.slice(1)} Tank`, value: `$${tLow} - $${tHigh}` });
        
        // 3. Drainfield
        const [dfLow, dfHigh] = COST_DATA.installation.drainfield[system.split('-')[0]];
        const dfTotalLow = dfLow * bedroomCount;
        const dfTotalHigh = dfHigh * bedroomCount;
        low += dfTotalLow; high += dfTotalHigh;
        breakdown.push({ label: 'Drainfield/Leach Field', value: `$${dfTotalLow.toLocaleString()} - $${dfTotalHigh.toLocaleString()}` });

        // 4. Labor & Excavation
        const laborType = ['conventional-gravity', 'conventional-chamber', 'conventional-pump'].includes(system) ? 'conventional' : 'advanced';
        const [lLow, lHigh] = COST_DATA.installation.excavationAndLabor[laborType];
        low += lLow; high += lHigh;
        breakdown.push({ label: 'Labor & Excavation', value: `$${lLow} - $${lHigh}` });

        // 5. Additional System Units & Notes
        if (system === 'mound') {
            const [mLow, mHigh] = COST_DATA.installation.advancedSystemUnits.moundFill;
            low += mLow; high += mHigh;
            breakdown.push({ label: 'Mound Sand Fill', value: `$${mLow} - $${mHigh}` });
            notes.push('Mound systems are significantly more expensive due to the cost of specialized sand and complex labor.');
        }
        if (system === 'atu-aerobic') {
            const [aLow, aHigh] = COST_DATA.installation.advancedSystemUnits.atu;
            low += aLow; high += aHigh;
            breakdown.push({ label: 'Aerobic Treatment Unit', value: `$${aLow} - $${aHigh}` });
            notes.push('ATUs require electricity and have higher maintenance costs, but provide superior wastewater treatment.');
        }

        // Final regional adjustment
        const finalLow = low * multiplier;
        const finalHigh = high * multiplier;
        
        notes.push(`Your estimate is adjusted for a <strong>${region}</strong> cost area.`);
        notes.push('<strong>Disclaimer:</strong> This is a budget estimation tool. Final costs require a site inspection from a licensed local contractor.');

        return {
            title: `Estimate for a New ${SYSTEM_NAMES[system]}`,
            range: [finalLow, finalHigh],
            breakdown: breakdown,
            notes: notes
        };
    }

    function calculateRepairCost() {
         const region = regionSelect.value;
         const multiplier = COST_DATA.regions[region] || 1.0;
         
         let low = 0, high = 0;
         const breakdown = [];
         
         repairCheckboxes.forEach(box => {
            if (box.checked) {
                const item = box.value;
                const [rLow, rHigh] = COST_DATA.repair[item];
                low += rLow; high += rHigh;
                breakdown.push({ label: `${item.charAt(0).toUpperCase() + item.slice(1)} Replacement`, value: `$${rLow} - $${rHigh}` });
            }
         });

        if (low === 0) {
            alert('Please select at least one repair item.');
            return null;
        }

        const finalLow = low * multiplier;
        const finalHigh = high * multiplier;

        return {
            title: 'Estimate for Septic System Repairs',
            range: [finalLow, finalHigh],
            breakdown: breakdown,
            notes: [
                `Your estimate is adjusted for a <strong>${region}</strong> cost area.`,
                'Costs assume standard replacement and do not include potential excavation complications.'
            ]
        };
    }

    function calculateMaintenanceCost() {
        const region = regionSelect.value;
        const multiplier = COST_DATA.regions[region] || 1.0;
        const tankSize = parseInt(tankSizeSelect.value);
        const sizeFactor = tankSize / 1000;

        let low = 0, high = 0;
        const breakdown = [];
        
        const [pLow, pHigh] = COST_DATA.maintenance.pumping;
        low += pLow * sizeFactor; high += pHigh * sizeFactor;
        breakdown.push({ label: `Pumping (${tankSize}g)`, value: `$${Math.round(pLow * sizeFactor)} - $${Math.round(pHigh * sizeFactor)}` });

        const [iLow, iHigh] = COST_DATA.maintenance.inspection;
        low += iLow; high += iHigh;
        breakdown.push({ label: `Full System Inspection`, value: `$${iLow} - $${iHigh}` });

        const finalLow = low * multiplier;
        const finalHigh = high * multiplier;

        return {
            title: 'Estimate for Routine Maintenance',
            range: [finalLow, finalHigh],
            breakdown: breakdown,
            notes: [
                `Your estimate is adjusted for a <strong>${region}</strong> cost area.`,
                'It is recommended to have your system pumped and inspected every 3-5 years.'
            ]
        };
    }

    // ===================================================================================
    // === 5. INITIALIZE THE APPLICATION ===
    // ===================================================================================
    
    init();

});
