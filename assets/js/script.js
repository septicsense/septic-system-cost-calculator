/**
 * Septic System Estimator - Definitive Script
 * Author: Your Name/septicsense
 * Version: 2.0.0 (Professional Rebuild)
 * Description: The core logic engine for the hyper-detailed septic system cost estimator.
 * This script loads external data, manages the UI wizard, and performs complex, multi-variable cost calculations.
 */

document.addEventListener('DOMContentLoaded', () => {
    // ===================================================================================
    // === 1. APPLICATION STATE & DATA STORAGE ===
    // ===================================================================================

    let septicData = null;
    let regionalData = null;
    let appState = {
        workType: null, // 'installation', 'repair', 'maintenance'
        currentPanel: 1,
        formData: {}
    };

    // ===================================================================================
    // === 2. DOM ELEMENT SELECTORS (THE "WIRES") ===
    // ===================================================================================

    const form = document.getElementById('septic-calculator-form');
    const panels = { 1: document.getElementById('panel-1'), 2: document.getElementById('panel-2') };
    const steps = { 1: document.getElementById('step-1'), 2: document.getElementById('step-2'), 3: document.getElementById('step-3') };
    const panel2Title = document.getElementById('panel-2-title');
    const selectionCards = document.querySelectorAll('.selection-card');
    const questionGroups = {
        installation: document.getElementById('installation-questions'),
        repair: document.getElementById('repair-questions'),
        maintenance: document.getElementById('maintenance-questions')
    };
    const backBtn = document.getElementById('back-btn-2');
    const startOverBtn = document.getElementById('start-over-btn');

    // --- Form Inputs ---
    const regionSelect = document.getElementById('region');
    const bedroomsSelect = document.getElementById('bedrooms');
    const peopleSelect = document.getElementById('people');
    const waterUsageSelect = document.getElementById('water-usage');
    const soilTypeSelect = document.getElementById('soil-type');
    const systemTypeSelect = document.getElementById('system-type');
    const tankSizeSelect = document.getElementById('tank-size');
    const tankMaterialSelect = document.getElementById('tank-material');
    const repairOptionsContainer = document.getElementById('repair-options-container');
    const maintTankSizeSelect = document.getElementById('maint-tank-size');

    // --- Results Display ---
    const resultsPlaceholder = document.getElementById('results-placeholder');
    const resultsOutput = document.getElementById('results-output');
    const systemInfoBox = document.getElementById('system-info-box');
    const systemInfoTitle = document.getElementById('system-info-title');
    const systemInfoDescription = document.getElementById('system-info-description');
    const resultsSummaryText = document.getElementById('results-summary-text');
    const resultsRange = document.getElementById('results-range');
    const resultsBreakdown = document.getElementById('results-breakdown');
    const resultsNotes = document.getElementById('results-notes');

    // ===================================================================================
    // === 3. INITIALIZATION & DATA FETCHING ===
    // ===================================================================================

    async function initializeApp() {
        try {
            const [septicRes, regionalRes] = await Promise.all([
                fetch('data/septic_systems.json'),
                fetch('data/regional_cost_data.json')
            ]);
            if (!septicRes.ok || !regionalRes.ok) throw new Error('Failed to load critical data files.');
            
            septicData = await septicRes.json();
            regionalData = await regionalRes.json();

            populateStaticDropdowns();
            setupEventListeners();
            console.log("Septic Estimator Initialized Successfully.");

        } catch (error) {
            console.error("Initialization Fatal Error:", error);
            panel2Title.textContent = "Error: Could not load calculator data.";
            // Disable the form if data loading fails
            form.style.display = 'none';
        }
    }

    function populateStaticDropdowns() {
        // Populate Region/State dropdown from the definitive data
        const states = Object.keys(regionalData).filter(key => key.length === 2).sort((a, b) => regionalData[a].name.localeCompare(regionalData[b].name));
        states.forEach(stateKey => {
            const option = new Option(`${regionalData[stateKey].name} (${stateKey})`, stateKey);
            regionSelect.add(option);
        });

        // Populate Repair options dynamically from the definitive data
        repairOptionsContainer.innerHTML = '';
        for (const key in septicData.repair) {
            const repair = septicData.repair[key];
            const div = document.createElement('div');
            div.className = 'form-group-checkbox';
            div.innerHTML = `<input type="checkbox" id="repair-${key}" name="repair-item" value="${key}"><label for="repair-${key}">${repair.name}</label>`;
            repairOptionsContainer.appendChild(div);
        }
    }

    // ===================================================================================
    // === 4. UI CONTROLLER & EVENT HANDLERS ===
    // ===================================================================================

    function setupEventListeners() {
        selectionCards.forEach(card => card.addEventListener('click', handleWorkTypeSelection));
        backBtn.addEventListener('click', () => goToPanel(1));
        startOverBtn.addEventListener('click', resetCalculator);
        form.addEventListener('submit', handleFormSubmit);

        soilTypeSelect.addEventListener('change', handleSoilChange);
        systemTypeSelect.addEventListener('change', handleSystemChange);
        bedroomsSelect.addEventListener('change', recommendTankSize);
        peopleSelect.addEventListener('change', recommendTankSize);
    }

    function handleWorkTypeSelection(e) {
        appState.workType = e.currentTarget.dataset.workType;
        selectionCards.forEach(card => card.classList.remove('selected'));
        e.currentTarget.classList.add('selected');
        
        updateFormForWorkType(appState.workType);
        setTimeout(() => goToPanel(2), 300);
    }

    function updateFormForWorkType(workType) {
        Object.values(questionGroups).forEach(group => group.classList.add('hidden'));
        if (questionGroups[workType]) {
            questionGroups[workType].classList.remove('hidden');
        }
        const titles = { installation: 'New Installation Profile', repair: 'Repair Details', maintenance: 'Maintenance Details' };
        panel2Title.textContent = titles[workType] || 'Details';
        if (workType === 'installation') recommendTankSize();
    }

    function handleSoilChange() {
        const soilType = soilTypeSelect.value;
        systemTypeSelect.innerHTML = '<option value="" disabled selected>Select system...</option>';
        systemInfoBox.classList.add('hidden');

        for (const key in septicData.systems) {
            const system = septicData.systems[key];
            if (system.soil_compatibility.includes(soilType)) {
                const option = new Option(system.name, key);
                systemTypeSelect.add(option);
            }
        }
    }

    function handleSystemChange() {
        const systemKey = systemTypeSelect.value;
        if (!systemKey || !septicData.systems[systemKey]) {
            systemInfoBox.classList.add('hidden');
            return;
        }
        const system = septicData.systems[systemKey];
        systemInfoTitle.textContent = system.name;
        systemInfoDescription.textContent = system.description;
        systemInfoBox.classList.remove('hidden');
    }

    function recommendTankSize() {
        const bedrooms = bedroomsSelect.value;
        const people = peopleSelect.value;
        let recommendedSize = 1000;

        if (bedrooms === '4' || people === '5-6') recommendedSize = 1250;
        if (bedrooms === '5' || bedrooms === '6+' || people === '7+') recommendedSize = 1500;
        
        const sizes = [1000, 1250, 1500, 1750, 2000];
        const currentSelection = tankSizeSelect.value;
        tankSizeSelect.innerHTML = '';
        sizes.forEach(size => {
            const option = new Option(`${size} Gallons`, size);
            if (size === recommendedSize) {
                option.textContent += ' (Recommended)';
                option.selected = true;
            }
            tankSizeSelect.add(option);
        });
        // Preserve user's override if they already made one
        if (currentSelection && sizes.includes(parseInt(currentSelection))) {
            tankSizeSelect.value = currentSelection;
        }
    }

    function goToPanel(panelNumber) {
        appState.currentPanel = panelNumber;
        document.querySelectorAll('.form-panel').forEach(p => p.classList.remove('active'));
        if (panels[panelNumber]) panels[panelNumber].classList.add('active');
        
        document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
        if (steps[panelNumber]) steps[panelNumber].classList.add('active');
        if (panelNumber > 1) steps[1].classList.add('active');
        if (panelNumber > 2) steps[2].classList.add('active');
    }
    
    function goToResults() {
        goToPanel(3);
        resultsPlaceholder.classList.add('hidden');
        resultsOutput.classList.remove('hidden');
        resultsBreakdown.querySelectorAll('.breakdown-item').forEach((item, index) => {
            item.style.animationDelay = `${index * 80}ms`;
        });
    }

    function handleFormSubmit(e) {
        e.preventDefault();
        const formData = new FormData(form);
        appState.formData = Object.fromEntries(formData.entries());
        
        const results = calculateEstimate();
        if (results) {
            displayResults(results);
            goToResults();
        }
    }
    
    function displayResults(results) {
        const formatCurrency = (num) => `$${Math.round(num).toLocaleString()}`;
        
        resultsSummaryText.textContent = results.title;
        resultsRange.textContent = `${formatCurrency(results.range[0])} - ${formatCurrency(results.range[1])}`;
        resultsBreakdown.innerHTML = results.breakdown.map(item => `
            <div class="breakdown-item fade-in-up">
                <span class="label">${item.label}</span>
                <span class="value">${item.value}</span>
            </div>
        `).join('');
        resultsNotes.innerHTML = results.notes.map(note => `<p>${note}</p>`).join('');
    }

    function resetCalculator() {
        appState = { workType: null, currentPanel: 1, formData: {} };
        form.reset();
        selectionCards.forEach(card => card.classList.remove('selected'));
        resultsOutput.classList.add('hidden');
        resultsPlaceholder.classList.remove('hidden');
        systemInfoBox.classList.add('hidden');
        handleSoilChange(); // Reset system type dropdown
        goToPanel(1);
    }

    // ===================================================================================
    // === 5. THE HYPER-DETAILED CALCULATION ENGINE ===
    // ===================================================================================

    function calculateEstimate() {
        if (!appState.formData.region) {
            alert('Please select a location.');
            return null;
        }
        switch (appState.workType) {
            case 'installation': return calculateInstallation();
            case 'repair': return calculateRepair();
            case 'maintenance': return calculateMaintenance();
            default: return null;
        }
    }
    
    function calculateInstallation() {
        const { region, bedrooms, people, 'water-usage': water, 'soil-type': soil, 'system-type': systemKey, 'tank-size': tankSize, 'tank-material': tankMaterial } = appState.formData;
        if (!soil || !systemKey) {
            alert('Please fill out all site and system fields.');
            return null;
        }

        const system = septicData.systems[systemKey];
        const stateData = regionalData[region] || regionalData.default;
        
        let low = 0, high = 0;
        const breakdown = [];
        const notes = [];

        // 1. Sum Base Costs from Components
        for (const [key, value] of Object.entries(system.cost_breakdown)) {
            low += value[0];
            high += value[1];
            const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            breakdown.push({ label, value: `$${value[0].toLocaleString()} - $${value[1].toLocaleString()}` });
        }
        
        // 2. Fine-tuning Adjustments & Multipliers
        const waterMultiplier = { low: 0.95, average: 1.0, high: 1.10 }[water];
        const tankSizeMultiplier = (parseInt(tankSize) / 1000); // 1250gal is 1.25x the cost of 1000gal base
        
        // Apply fine-tuning only to relevant components
        low = (low * tankSizeMultiplier) * waterMultiplier;
        high = (high * tankSizeMultiplier) * waterMultiplier;

        // Apply FINAL regional multiplier to the subtotal
        low *= stateData.multiplier;
        high *= stateData.multiplier;
        
        // 3. Build Notes for Transparency
        notes.push(`Costs are adjusted by <strong>${((stateData.multiplier - 1) * 100).toFixed(0)}%</strong> for your selected region (<strong>${stateData.name}</strong>).`);
        if (waterMultiplier !== 1.0) notes.push(`A <strong>${water} water usage</strong> adjustment of <strong>${waterMultiplier}x</strong> has been applied to the subtotal.`);
        if (tankSize !== '1000') notes.push(`Cost adjusted for a <strong>${tankSize} gallon</strong> tank.`);
        
        notes.push('<strong>Disclaimer:</strong> This is an advanced budget estimation. A formal quote requires a professional site evaluation and soil (percolation) test.');

        return {
            title: `Estimate for a New ${system.name}`,
            range: [low, high],
            breakdown,
            notes
        };
    }
    
    function calculateRepair() {
        const { region } = appState.formData;
        const stateData = regionalData[region] || regionalData.default;
        const selectedRepairs = Array.from(document.querySelectorAll('input[name="repair-item"]:checked')).map(cb => cb.value);
        if (selectedRepairs.length === 0) {
            alert('Please select at least one repair item.');
            return null;
        }

        let low = 0, high = 0;
        const breakdown = [];
        selectedRepairs.forEach(key => {
            const repair = septicData.repair[key];
            low += repair.min;
            high += repair.max;
            breakdown.push({ label: repair.name, value: `$${repair.min} - $${repair.max}` });
        });

        return {
            title: 'Estimate for System Repairs',
            range: [low * stateData.multiplier, high * stateData.multiplier],
            breakdown,
            notes: [`Costs are adjusted for your selected region (<strong>${stateData.name}</strong>). Does not include excavation complexities.`]
        };
    }

    function calculateMaintenance() {
        // Similar logic to repair, can be expanded for more options later
        return calculateRepair(); // For now, maintenance uses the same simple logic.
    }

    // ===================================================================================
    // === 6. START THE ENGINE ===
    // ===================================================================================

    initializeApp();
});
