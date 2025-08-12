// This is the main function that runs only after the entire page is loaded.
function onPageLoaded() {

    // --- 1. ELEMENT REFERENCES ---
    // We get every element we need once at the start.
    const form = document.getElementById('septic-calculator-form');
    if (!form) {
        console.error("FATAL ERROR: The main form with id 'septic-calculator-form' was not found. The script cannot continue.");
        return;
    }
    const formSteps = document.querySelectorAll('.form-step');
    const calcTypeSelect = document.getElementById('calculation-type');
    const systemTypeSelect = document.getElementById('system-type');
    const stateSelect = document.getElementById('state');
    const resultsOutput = document.getElementById('results-output');
    const sidebarPlaceholder = document.querySelector('.sidebar-placeholder');
    const pdfDownloadArea = document.getElementById('pdf-download-area');

    // Navigation Buttons by their unique ID
    const nextBtn1 = document.getElementById('next-btn-1');
    const prevBtn2 = document.getElementById('prev-btn-2');
    const nextBtn2 = document.getElementById('next-btn-2');
    const prevBtn3 = document.getElementById('prev-btn-3');
    const nextBtn3 = document.getElementById('next-btn-3');
    const prevBtn4 = document.getElementById('prev-btn-4');

    // --- 2. STATE MANAGEMENT ---
    const calculator = new SepticCalculator();
    let latestQuoteData = null;

    // --- 3. CORE FUNCTIONS ---

    // Navigates to a specific step number
    const navigateToStep = (stepNumber) => {
        formSteps.forEach(step => step.classList.remove('active'));
        const targetStep = document.querySelector(`.form-step[data-step="${stepNumber}"]`);
        if (targetStep) {
            targetStep.classList.add('active');
        }
    };

    // Updates the "System Type" dropdown based on the work type
    const updateSystemTypeOptions = () => {
        if (!calculator.systemData) return;
        const selectedType = calcTypeSelect.value;
        const options = calculator.systemData[selectedType];
        systemTypeSelect.innerHTML = '';
        if (!options) return;
        for (const key in options) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = options[key].name;
            systemTypeSelect.appendChild(option);
        }
    };

    // Fills the State dropdown from our data
    const populateStateOptions = () => {
        if (!calculator.regionalData) return;
        const states = Object.keys(calculator.regionalData).filter(k => k !== 'default').sort((a, b) => calculator.regionalData[a].name.localeCompare(calculator.regionalData[b].name));
        states.forEach(stateKey => {
            const option = document.createElement('option');
            option.value = stateKey;
            option.textContent = calculator.regionalData[stateKey].name;
            stateSelect.appendChild(option);
        });
    };

    // Displays the final results in the sidebar
    const displayResults = (result) => {
        sidebarPlaceholder.style.display = 'none';
        pdfDownloadArea.style.display = 'none';
        if (result.error) {
            resultsOutput.innerHTML = `<div class="error-message">${result.message}</div>`;
            latestQuoteData = null;
            return;
        }
        latestQuoteData = result;
        const { minEstimate, maxEstimate, type, systemName, breakdown, description } = result;
        let breakdownHtml = '';
        if (type === 'installation' && breakdown) {
            const labels = { design_and_permits: "Design & Permits", tank: "Tank & Materials", drainfield: "Drain Field", excavation_and_labor: "Labor & Excavation" };
            for (const key in breakdown) {
                const item = breakdown[key];
                breakdownHtml += `<div class="breakdown-item"><span class="label">${labels[key]}</span><span class="value">$${item.min.toLocaleString()} - $${item.max.toLocaleString()}</span></div>`;
            }
        } else {
            breakdownHtml = `<p class="sidebar-description">${description}</p>`;
        }
        resultsOutput.innerHTML = `
            <h3 class="sidebar-subtitle">${systemName}</h3>
            <div class="results-breakdown">${breakdownHtml}</div>
            <div class="results-total">
                <div class="label">Total Estimated Cost</div>
                <div class="value">$${minEstimate.toLocaleString()} - $${maxEstimate.toLocaleString()}</div>
            </div>`;
        pdfDownloadArea.style.display = 'block';
    };

    // --- 4. EVENT LISTENERS SETUP ---
    // A single function to attach all our event listeners
    const setupEventListeners = () => {
        nextBtn1.addEventListener('click', () => navigateToStep(2));
        prevBtn2.addEventListener('click', () => navigateToStep(1));
        nextBtn2.addEventListener('click', () => {
            navigateToStep(calcTypeSelect.value === 'installation' ? 3 : 4);
        });
        prevBtn3.addEventListener('click', () => navigateToStep(2));
        nextBtn3.addEventListener('click', () => navigateToStep(4));
        prevBtn4.addEventListener('click', () => {
            navigateToStep(calcTypeSelect.value === 'installation' ? 3 : 2);
        });
        calcTypeSelect.addEventListener('change', updateSystemTypeOptions);

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const userInputs = Object.fromEntries(new FormData(form).entries());
            displayResults(calculator.calculateCost(userInputs));
        });

        pdfDownloadArea.addEventListener('click', () => {
            if (!latestQuoteData || latestQuoteData.error) {
                alert("Cannot generate PDF from an invalid or incomplete estimate.");
                return;
            }
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ unit: "in", format: "letter" });
            const { minEstimate, maxEstimate, type, systemName, breakdown, userInput, description } = latestQuoteData;
            const { state, zipCode, householdSize, waterUsage, soilType } = userInput;

            doc.setProperties({ title: `Septic Estimate - ${zipCode}` });
            doc.setFont("helvetica", "bold");
            doc.setFontSize(22);
            doc.text("Septic System Cost Estimate", doc.internal.pageSize.getWidth() / 2, 0.75, { align: "center" });
            doc.setFontSize(11);
            doc.setFont("helvetica", "normal");
            doc.text(`Date Generated: ${new Date().toLocaleDateString('en-US')}`, 1, 1.25);
            doc.text(`Prepared for property in ZIP Code: ${zipCode}, ${state}`, 1, 1.5);
            doc.setLineWidth(0.01);
            doc.line(1, 1.75, 7.5, 1.75);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.text("Project Summary", 1, 2.2);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(11);
            let y = 2.5;
            doc.text(`Work Type: ${type.charAt(0).toUpperCase() + type.slice(1)}`, 1.25, y); y += 0.25;
            doc.text(`System/Job: ${systemName}`, 1.25, y);
            if (type === 'installation') {
                y += 0.25; doc.text(`Household Size: ${householdSize} people`, 1.25, y);
                y += 0.25; doc.text(`Water Usage: ${waterUsage.charAt(0).toUpperCase() + waterUsage.slice(1)}`, 1.25, y);
                y += 0.25; doc.text(`Soil Condition: ${soilType.charAt(0).toUpperCase() + soilType.slice(1)}`, 1.25, y);
            }
            y += 0.6;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.text(type === 'installation' ? "Estimated Cost Breakdown" : "Job Description", 1, y); y += 0.3;
            doc.setFont("helvetica", "normal");
            if (type === 'installation' && breakdown) {
                const labels = { design_and_permits: "Design & Permitting:", tank: "Tank & Materials:", drainfield: "Drain Field & Piping:", excavation_and_labor: "Excavation & Labor:" };
                doc.setFontSize(11);
                for (const key in breakdown) {
                    const item = breakdown[key];
                    const value = `$${item.min.toLocaleString(undefined, {maximumFractionDigits:0})} - $${item.max.toLocaleString(undefined, {maximumFractionDigits:0})}`;
                    doc.text(labels[key] || key, 1.25, y);
                    doc.text(value, 7.5, y, { align: "right" });
                    y += 0.25;
                }
            } else {
                 doc.setFontSize(10);
                 doc.text(description, 1.25, y, { maxWidth: 6.25 }); y += 0.5;
            }
            doc.setLineWidth(0.02);
            doc.line(1, y + 0.1, 7.5, y + 0.1); y += 0.4;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(16);
            doc.text("Total Estimated Range:", 1, y);
            doc.setFontSize(20);
            doc.text(`$${minEstimate.toLocaleString()} - $${maxEstimate.toLocaleString()}`, 7.5, y, { align: "right" });
            const disclaimer = "This is a preliminary estimate for budgeting purposes only and is not a formal quote... It is highly recommended to get multiple quotes from qualified local professionals.";
            doc.setFont("helvetica", "italic");
            doc.setFontSize(9);
            doc.setTextColor("#888888");
            doc.text(disclaimer, 1, 10, { maxWidth: 6.5, align: "left" });
            doc.save(`Septic_Estimate_${zipCode}.pdf`);
        });
    };

    // --- 5. INITIALIZATION ---
    // This is the first function that runs. It orchestrates everything else.
    const initializeApp = async () => {
        await calculator.loadData(); // First, load all necessary data
        populateStateOptions();      // Then, fill the dropdowns
        updateSystemTypeOptions();
        setupEventListeners();       // THEN, attach listeners to buttons
        navigateToStep(1);           // Finally, show the first step
    };

    // Start the application
    initializeApp();

} // This closes the main onPageLoaded function

// This is the safeguard that prevents all errors. It ensures the script
// only runs after the HTML page is 100% ready.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onPageLoaded);
} else {
    onPageLoaded();
}