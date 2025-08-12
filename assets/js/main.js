// This command waits for the entire HTML page to be loaded and ready before running our script.
// This is the main container for all our code.
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. GETTING OUR HTML ELEMENTS ---
    // All variables defined here are visible to all other code inside this block.
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const calculateBtn = document.getElementById('calculate-btn');
    const septicForm = document.getElementById('septic-calculator-form');
    
    const formSteps = document.querySelectorAll('.form-step');
    const stepIndicators = document.querySelectorAll('.step-indicator .step');
    
    const resultsOutput = document.getElementById('results-output');
    const pdfDownloadArea = document.getElementById('pdf-download-area');
    const systemTypeSelect = document.getElementById('system-type');

    // --- 2. SETTING UP OUR STATE ---
    let currentStep = 0; // We start at step 0.
    let latestQuoteData = null; // To store data for the PDF.

    // --- 3. CREATE CALCULATOR INSTANCE ---
    const calculator = new SepticCalculator();

    // --- 4. CORE FUNCTIONS ---

    // This function updates which form step is visible.
    function updateFormSteps() {
        formSteps.forEach(step => {
            step.classList.remove('active', 'slide-in-from-right');
        });
        formSteps[currentStep].classList.add('active', 'slide-in-from-right');
        
        updateStepIndicators();
        updateNavigationButtons();
    }

    // This function updates the step indicators at the top.
    function updateStepIndicators() {
        stepIndicators.forEach((indicator, index) => {
            if (index === currentStep) {
                indicator.classList.add('active');
            } else {
                indicator.classList.remove('active');
            }
        });
    }

    // This function shows/hides the correct navigation buttons.
    function updateNavigationButtons() {
        prevBtn.style.display = currentStep > 0 ? 'inline-block' : 'none';
        nextBtn.style.display = currentStep < formSteps.length - 1 ? 'inline-block' : 'none';
        calculateBtn.style.display = currentStep === formSteps.length - 1 ? 'inline-block' : 'none';
    }
    
    // This function populates the "System Type" dropdown from loaded data.
    function populateSystemTypes() {
        if (!calculator.systemData) {
            console.error("Cannot populate systems: data not loaded.");
            return;
        }
        const systems = calculator.systemData.installation;
        systemTypeSelect.innerHTML = ''; 

        const defaultOption = document.createElement('option');
        defaultOption.value = "";
        defaultOption.textContent = "Select a system type...";
        defaultOption.disabled = true;
        defaultOption.selected = true;
        systemTypeSelect.appendChild(defaultOption);

        for (const key in systems) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = systems[key].name;
            systemTypeSelect.appendChild(option);
        }
    }
    
    // This function handles displaying the final results.
    function displayResults(result) {
        let html = '';
        if (result.error) {
            html = `<div class="error-message">
                        <h3>Incompatible Selection</h3>
                        <p>${result.message}</p>
                    </div>`;
            pdfDownloadArea.style.display = 'none';
        } else {
            latestQuoteData = result.quoteDetails; // Save the details for the PDF
            html = `<div class="results-summary">
                        <h3>Estimate for a ${result.quoteDetails.system.name}</h3>
                        <div class="cost-range">
                            <h2>$${result.minEstimate.toLocaleString()} - $${result.maxEstimate.toLocaleString()}</h2>
                        </div>
                        <p class="disclaimer">${result.message}</p>
                    </div>`;
            pdfDownloadArea.style.display = 'block';
        }
        resultsOutput.innerHTML = html;
    }

    // --- 5. EVENT LISTENERS ---

    nextBtn.addEventListener('click', () => {
        if (currentStep < formSteps.length - 1) {
            currentStep++;
            updateFormSteps();
        }
    });

    prevBtn.addEventListener('click', () => {
        if (currentStep > 0) {
            currentStep--;
            updateFormSteps();
        }
    });

    septicForm.addEventListener('submit', (event) => {
        event.preventDefault(); // Stop page reload

        resultsOutput.innerHTML = `<div class="loading-spinner active"></div>`;
        pdfDownloadArea.style.display = 'none';

        const formData = new FormData(septicForm);
        const userInputs = Object.fromEntries(formData.entries());

        setTimeout(() => {
            const result = calculator.calculateInstallationCost(userInputs);
            displayResults(result);
        }, 500);
    });
    
    pdfDownloadArea.addEventListener('click', () => {
        if (!latestQuoteData) {
            alert("Please calculate an estimate first.");
            return;
        }
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const { userInput, system, adjustments, permitFee } = latestQuoteData;

        // PDF STYLING & CONTENT
        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.text("Septic System Cost Estimate", 105, 20, null, null, "center");

        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.text(`Date: ${new Date().toLocaleDateString('en-US')}`, 15, 30);
        doc.text(`Quote prepared for ZIP Code: ${userInput.zipCode}`, 15, 37);
        doc.setLineWidth(0.5);
        doc.line(15, 45, 195, 45);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("Project Details", 15, 55);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
        doc.text(`- Home Size: ${userInput.bedrooms} Bedrooms`, 20, 65);
        doc.text(`- Soil Type: ${userInput.soilType.charAt(0).toUpperCase() + userInput.soilType.slice(1)}`, 20, 72);
        doc.text(`- System Type: ${system.name}`, 20, 79);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("Estimated Cost Breakdown", 15, 95);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
        const basePriceText = `Base System Cost: $${system.basePrice.min.toLocaleString()} - $${system.basePrice.max.toLocaleString()}`;
        doc.text(basePriceText, 20, 105);

        const combinedMultiplier = adjustments.regionalMultiplier * adjustments.soilMultiplier * adjustments.bedroomMultiplier;
        doc.text(`Combined Adjustments (Location, Soil, etc.): ~${combinedMultiplier.toFixed(2)}x`, 20, 112);
        doc.text(`Estimated Permit Fees: $${permitFee.min} - $${permitFee.max}`, 20, 119);
        
        doc.setLineWidth(0.2);
        doc.line(15, 130, 195, 130);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);

        // ** CRITICAL BUG FIX HERE **: 'baseprice' was corrected to 'basePrice'
        const finalMin = (system.basePrice.min * combinedMultiplier) + permitFee.min;
        const finalMax = (system.basePrice.max * combinedMultiplier) + permitFee.max;

        doc.text("Total Estimated Range:", 15, 140);
        doc.setFontSize(22);
        doc.text(`$${(Math.round(finalMin/100)*100).toLocaleString()} - $${(Math.round(finalMax/100)*100).toLocaleString()}`, 105, 150, null, null, "center");
        doc.setLineWidth(0.5);
        doc.line(60, 155, 150, 155);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(150);
        const disclaimer = "This is a preliminary estimate for budgeting purposes only. It is not a formal quote. Costs can vary based on site-specific conditions, local regulations, and contractor pricing. It is recommended to get multiple quotes from qualified local professionals.";
        doc.text(disclaimer, 15, 180, { maxWidth: 180 });

        doc.save(`Septic_Estimate_${userInput.zipCode}.pdf`);
    });

    // --- 6. INITIALIZATION ---

    // An async function to set everything up when the page loads.
    async function initializeApp() {
        await calculator.loadData(); // Wait for data to be fetched
        populateSystemTypes();       // Then populate the dropdown
        updateFormSteps();           // And set the initial form state
    }

    initializeApp(); // Run the initialization function!

});