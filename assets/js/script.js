/**
 * Septic System Estimator - Definitive Script v4.8 (Final Code)
 * Description: Relies on native CSS @media print styles for robust PDF rendering,
 * simplifying the JavaScript and permanently fixing all rendering bugs.
 */
document.addEventListener('DOMContentLoaded', () => {
    // State and Data
    let septicData = null, regionalData = null;
    let appState = { workType: null, currentPanel: 1 };

    // DOM Elements
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
    const backBtn = document.getElementById('back-btn-2'), startOverBtn = document.getElementById('start-over-btn');
    const stateSelect = document.getElementById('state');
    const repairOptionsContainer = document.getElementById('repair-options-container');
    const maintenanceOptionsContainer = document.getElementById('maintenance-options-container');
    const systemTypeSelect = document.getElementById('system-type');
    const soilTypeSelect = document.getElementById('soil-type');
    const systemInfoBox = document.getElementById('system-info-box');
    const resultsPlaceholder = document.getElementById('results-placeholder');
    const resultsOutput = document.getElementById('results-output');
    const resultsSummaryText = document.getElementById('results-summary-text');
    const resultsRange = document.getElementById('results-range');
    const resultsBreakdown = document.getElementById('results-breakdown');
    const resultsNotes = document.getElementById('results-notes');
    const tankSizeSelect = document.getElementById('tank-size');
    const bedroomsSelect = document.getElementById('bedrooms');
    const peopleSelect = document.getElementById('people');
    const downloadPdfBtn = document.getElementById('download-pdf-btn');
    
    // --- INITIALIZATION ---
    async function initializeApp() {
        try {
            const [septicRes, regionalRes] = await Promise.all([ fetch('data/septic_systems.json'), fetch('data/regional_cost_data.json') ]);
            if (!septicRes.ok || !regionalRes.ok) throw new Error('Failed to load critical data files.');
            septicData = await septicRes.json();
            regionalData = await regionalRes.json();
            populateStaticUI();
            setupEventListeners();
            manageFormInputs(null);
        } catch (error) {
            console.error("Initialization Fatal Error:", error);
            document.querySelector('.app-main').innerHTML = `<p style="color:red; text-align:center;">A critical error occurred. Please ensure 'data/septic_systems.json' and 'data/regional_cost_data.json' are accessible.</p>`;
        }
    }

    function populateStaticUI() {
        const states = Object.keys(regionalData).filter(key => key.length === 2).sort((a, b) => regionalData[a].name.localeCompare(regionalData[b].name));
        states.forEach(key => stateSelect.add(new Option(`${regionalData[key].name} (${key})`, key)));
        const createCheckbox = (key, item, type) => `<div class="form-group-checkbox"><input type="checkbox" id="${type}-${key}" name="${type}-item" value="${key}"><label for="${type}-${key}">${item.name}</label></div>`;
        repairOptionsContainer.innerHTML = Object.entries(septicData.repair).map(([key, item]) => createCheckbox(key, item, 'repair')).join('');
        maintenanceOptionsContainer.innerHTML = Object.entries(septicData.maintenance).map(([key, item]) => createCheckbox(key, item, 'maintenance')).join('');
    }

    function manageFormInputs(activeWorkType) {
        for (const type in questionGroups) {
            const group = questionGroups[type];
            const inputs = group.querySelectorAll('input, select');
            if (type === activeWorkType) {
                group.classList.remove('hidden');
                inputs.forEach(input => input.disabled = false);
            } else {
                group.classList.add('hidden');
                inputs.forEach(input => input.disabled = true);
            }
        }
    }

    function setupEventListeners() {
        selectionCards.forEach(card => card.addEventListener('click', handleWorkTypeSelection));
        backBtn.addEventListener('click', () => goToPanel(1));
        startOverBtn.addEventListener('click', resetCalculator);
        form.addEventListener('submit', handleFormSubmit);
        soilTypeSelect.addEventListener('change', handleSoilChange);
        systemTypeSelect.addEventListener('change', () => displaySystemInfo(systemTypeSelect.value));
        bedroomsSelect.addEventListener('change', recommendTankSize);
        peopleSelect.addEventListener('change', recommendTankSize);
        downloadPdfBtn.addEventListener('click', generatePdf);
    }
    
    function handleWorkTypeSelection(e) {
        appState.workType = e.currentTarget.dataset.workType;
        selectionCards.forEach(card => card.classList.remove('selected'));
        e.currentTarget.classList.add('selected');
        manageFormInputs(appState.workType);
        const titles = { installation: 'New Installation Profile', repair: 'Repair Details', maintenance: 'Maintenance Details' };
        panel2Title.textContent = titles[appState.workType] || 'Details';
        if (appState.workType === 'installation') recommendTankSize();
        setTimeout(() => goToPanel(2), 300);
    }
    
    function handleSoilChange() {
        const soilType = soilTypeSelect.value;
        systemTypeSelect.innerHTML = '<option value="" disabled selected>Select system...</option>';
        systemInfoBox.classList.add('hidden');
        if (!soilType) return;
        for (const key in septicData.systems) {
            const system = septicData.systems[key];
            if (system.soil_compatibility.includes(soilType)) systemTypeSelect.add(new Option(system.name, key));
        }
    }
    
    function displaySystemInfo(systemKey) {
        if (!systemKey || !septicData.systems[systemKey]) { systemInfoBox.classList.add('hidden'); return; }
        const system = septicData.systems[systemKey];
        document.getElementById('system-info-title').textContent = system.name;
        document.getElementById('system-info-description').textContent = system.description;
        systemInfoBox.classList.remove('hidden');
    }

    function recommendTankSize() {
        let size = 1000;
        if (bedroomsSelect.value === '4' || peopleSelect.value === '5-6') size = 1250;
        if (['5', '6+'].includes(bedroomsSelect.value) || peopleSelect.value === '7+') size = 1500;
        const sizes = [1000, 1250, 1500, 1750, 2000];
        const currentVal = tankSizeSelect.value;
        tankSizeSelect.innerHTML = '';
        sizes.forEach(s => {
            const opt = new Option(`${s} Gallons`, s);
            if (s === size) { opt.textContent += ' (Recommended)'; opt.selected = true; }
            tankSizeSelect.add(opt);
        });
        if (currentVal && sizes.includes(parseInt(currentVal))) tankSizeSelect.value = currentVal;
    }

    function goToPanel(num) {
        appState.currentPanel = num;
        document.querySelectorAll('.form-panel').forEach(p => p.classList.remove('active'));
        if (panels[num]) panels[num].classList.add('active');
        document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
        if (steps[num]) steps[num].classList.add('active');
        for (let i = 1; i < num; i++) if(steps[i]) steps[i].classList.add('active');
    }

    function handleFormSubmit(e) {
        e.preventDefault();
        const results = calculateEstimate();
        if (results) displayResults(results);
    }
    
    function displayResults(results) {
    const format = (num) => `$${Math.round(num).toLocaleString()}`;
    resultsSummaryText.textContent = results.title;
    resultsRange.textContent = `${format(results.range[0])} - ${format(results.range[1])}`;
    
    // 🚨 Removed "fade-in-up" class here
    resultsBreakdown.innerHTML = results.breakdown.map(item => 
        `<div class="breakdown-item">
            <span class="label">${item.label}</span>
            <span class="value">${item.value}</span>
        </div>`
    ).join('');

    resultsNotes.innerHTML = results.notes.map(note => `<p>${note}</p>`).join('');
    goToPanel(3);
    resultsPlaceholder.classList.add('hidden');
    resultsOutput.classList.remove('hidden');
}


    function resetCalculator() {
        appState = { workType: null, currentPanel: 1 };
        form.reset();
        selectionCards.forEach(card => card.classList.remove('selected'));
        manageFormInputs(null);
        resultsOutput.classList.add('hidden');
        resultsPlaceholder.classList.remove('hidden');
        systemInfoBox.classList.add('hidden');
        handleSoilChange();
        goToPanel(1);
    }

    function generatePdf() {
        if (typeof html2pdf === 'undefined') {
            console.error('html2pdf library is not loaded. Cannot generate PDF.');
            alert('Sorry, the PDF generation library could not be loaded. Please check your internet connection and try again.');
            return;
        }
        const element = document.getElementById('results-output');
        const date = new Date().toISOString().slice(0, 10);
        const filename = `septic-quote-${appState.workType}-${date}.pdf`;
        const options = {
            margin:       [0.75, 0.5, 0.75, 0.5], // Adjusted margins for better layout
            filename:     filename,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        
        // This is now clean and simple. The CSS @media print handles all styling.
        html2pdf().set(options).from(element).save();
    }
    
    function calculateEstimate() {
        const data = Object.fromEntries(new FormData(form).entries());
        if (!data.state) { alert('Please select a state.'); return null; }
        switch (appState.workType) {
            case 'installation': return calculateInstallation(data);
            case 'repair': return calculateShared(data, 'repair');
            case 'maintenance': return calculateShared(data, 'maintenance');
        }
    }
    
    function calculateInstallation(data) {
        const { state, 'area-type': area, 'water-usage': water, 'soil-type': soil, 'system-type': systemKey } = data;
        if (!soil || !systemKey) { alert('Please fill out all site and system fields.'); return null; }
        const system = septicData.systems[systemKey];
        const stateData = regionalData[state] || regionalData.default;
        let low = 0, high = 0;
        const breakdown = [];
        for (const [key, value] of Object.entries(system.cost_breakdown)) {
            low += value[0]; high += value[1];
            const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            breakdown.push({ label, value: `$${value[0].toLocaleString()} - $${value[1].toLocaleString()}` });
        }
        const waterMultiplier = { low: 0.95, average: 1.0, high: 1.10 }[water];
        const areaMultiplier = { rural: 0.9, suburban: 1.0, urban: 1.15 }[area];
        low = low * waterMultiplier * stateData.multiplier * areaMultiplier;
        high = high * waterMultiplier * stateData.multiplier * areaMultiplier;
        const notes = [
            `Costs are adjusted for the state of <strong>${stateData.name}</strong> and a <strong>${area}</strong> area type.`,
            `A <strong>${water} water usage</strong> adjustment of <strong>${waterMultiplier}x</strong> has been applied.`,
            '<strong>Disclaimer:</strong> This is an advanced budget estimation. A formal quote requires a professional site evaluation and soil (percolation) test.'
        ];
        return { title: `Estimate for a New ${system.name}`, range: [low, high], breakdown, notes };
    }
    
    function calculateShared(data, type) {
        const stateData = regionalData[data.state] || regionalData.default;
        const areaMultiplier = { rural: 0.9, suburban: 1.0, urban: 1.15 }[data['area-type']];
        const selectedItems = Array.from(form.querySelectorAll(`input[name="${type}-item"]:checked`)).map(cb => cb.value);
        if (selectedItems.length === 0) { alert(`Please select at least one ${type} item.`); return null; }
        let low = 0, high = 0;
        const breakdown = [];
        selectedItems.forEach(key => {
            const item = septicData[type][key];
            low += item.min; high += item.max;
            breakdown.push({ label: item.name, value: `$${item.min} - $${item.max}` });
        });
        return {
            title: `Estimate for System ${type.charAt(0).toUpperCase() + type.slice(1)}`,
            range: [low * stateData.multiplier * areaMultiplier, high * stateData.multiplier * areaMultiplier],
            breakdown,
            notes: [`Costs are adjusted for <strong>${stateData.name}</strong> and a <strong>${data['area-type']}</strong> area type.`]
        };
    }
    
    initializeApp();
});
