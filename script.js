const numberInput = document.getElementById('numberInput');
const quickButtonsContainer = document.getElementById('quickButtons');
const liveResultDiv = document.getElementById('liveResult');
const toggleQuickButtons = document.getElementById('toggleQuickButtons');
const toggleLiveCalculation = document.getElementById('toggleLiveCalculation');
const alwaysVisibleOption = document.getElementById('alwaysVisibleOption');
const focusVisibleOption = document.getElementById('focusVisibleOption');

// Configuration
const quickNumbers = [20, 500, 1000, 5000];
const rawValueAttribute = 'data-raw-value'; // Attribute to store the unformatted number
const variables = {
    'ipt': 0.07,   // 7%
    'ukvat': 0.20  // 20%
};

// Feature toggle states
let showLiveCalculationEnabled = true;
let quickButtonsEnabled = true;
let quickButtonsVisibilityMode = 'always'; // 'always' or 'focus'
let isClickingQuickButton = false; // Track if we're clicking a quick button

// --- Helper Functions ---

/**
 * Formats a number with commas as thousand separators.
 * Handles null or undefined inputs gracefully.
 * @param {number | string | null | undefined} num The number to format.
 * @returns {string} The formatted number string, or an empty string if input is invalid.
 */
function formatNumberWithCommas(num) {
    if (num === null || num === undefined || num === '') return '';
    // Remove existing commas and convert to number for reliable formatting
    const numericValue = parseFloat(String(num).replace(/,/g, ''));
    if (isNaN(numericValue)) {
        // Handle cases where conversion might fail but we still want to display the input
        // e.g., during partial input like "1,234."
        // However, for this basic version, let's return empty if it's not easily parseable
        // A more sophisticated approach might be needed for complex intermediate states.
        return String(num); // Or return '' based on desired behavior for invalid numbers
    }
    return numericValue.toLocaleString('en-US');
}

// --- Initialization ---

/**
 * Creates and appends quick-select buttons to the container.
 */
function createQuickButtons() {
    quickNumbers.forEach(num => {
        const button = document.createElement('button');
        button.textContent = formatNumberWithCommas(num);
        button.value = num; // Store the raw number value
        
        // Add mousedown/touchstart event to set the flag before the focus is lost
        button.addEventListener('mousedown', () => {
            isClickingQuickButton = true;
        });
        button.addEventListener('touchstart', () => {
            isClickingQuickButton = true;
        });
        
        button.addEventListener('click', () => {
            const rawValue = button.value;
            numberInput.value = formatNumberWithCommas(rawValue);
            numberInput.setAttribute(rawValueAttribute, rawValue);
            
            // Keep focus on the input field after clicking a button
            numberInput.focus();
            
            // Reset the flag after a short delay
            setTimeout(() => {
                isClickingQuickButton = false;
            }, 100);
            
            // Optionally trigger change/input event if needed by other logic
            numberInput.dispatchEvent(new Event('input', { bubbles: true }));
            numberInput.dispatchEvent(new Event('change', { bubbles: true }));
        });
        quickButtonsContainer.appendChild(button);
    });
}

// Initial setup
createQuickButtons();

// --- Event Listeners (will be added next) ---

/**
 * Parses the input string, handling suffixes (k, m, b) and basic math.
 * @param {string} inputStr The raw string from the input field.
 * @returns {number | null} The parsed numeric value, or null if parsing fails.
 */
function parseInput(inputStr) {
    if (!inputStr) return null;

    let value = String(inputStr).trim().toLowerCase().replace(/,/g, ''); // Clean input

    // --- Preprocessing Step 1: Handle Percentage Calculations (e.g., 100 + UKVAT) ---
    let processedValue = value.replace(/(\d+(?:\.\d+)?)\s*([+-])\s*(ipt|ukvat)\b/gi, (match, numberStr, operator, varName) => {
        const number = parseFloat(numberStr);
        const varValue = variables[varName.toLowerCase()];
        if (!isNaN(number) && varValue !== undefined) {
            if (operator === '+') {
                return `${number} + (${number} * ${varValue})`;
            } else if (operator === '-') {
                // For subtraction, we need to divide by (1 + percentage) rather than multiply
                return `${number} / (1 + ${varValue})`;
            }
        }
        return match;
    });

    // --- Preprocessing Step 2: Replace Suffixes (k, m, b, t) within the expression ---
    processedValue = processedValue.replace(/(\d+(?:\.\d+)?)(k|m|b|t)\b/gi, (match, numberStr, suffix) => {
        const num = parseFloat(numberStr);
        if (!isNaN(num)) {
            switch (suffix.toLowerCase()) {
                case 'k': return (num * 1e3).toString();
                case 'm': return (num * 1e6).toString();
                case 'b': return (num * 1e9).toString();
                case 't': return (num * 1e12).toString();
            }
        }
        return match; // Return original if parsing fails
    });

    // --- Preprocessing Step 3: Replace General Variables ---
    // Check if the input *looks like* it might contain variables before iterating
    // This avoids unnecessary regex replaces if the input is purely numeric/suffix-based
    if (/[a-z]/i.test(processedValue)) {
        for (const varName in variables) {
            // Use regex with word boundaries (\b) to avoid partial replacements
            const regex = new RegExp('\\b' + varName + '\\b', 'gi');
            // Make sure the replacement happens on the *latest* processedValue
            processedValue = processedValue.replace(regex, variables[varName].toString());
        }
    }


    // --- Evaluation Step 1: Attempt Math Evaluation ---
    // Check if the fully processed string looks like a valid math expression
    if (/^[\d\s\.\+\-\*\/\(\)]+$/.test(processedValue)) {
        try {
            const result = new Function(`return ${processedValue}`)();
            if (typeof result === 'number' && isFinite(result)) {
                return result;
            }
        } catch (e) {
            console.warn("Math evaluation failed:", e);
        }
    }

    // --- Evaluation Step 2: Try Parsing Original Input as Direct Number ---
    // This covers cases where the original input was just a number, possibly with commas
    const directNum = parseFloat(value.replace(/,/g, ''));
    if (!isNaN(directNum) && !/[a-z+\-*\/\(\)]/i.test(value)) { // Ensure it wasn't intended as math/variable
        return directNum;
    }

    // --- Evaluation Step 3: Handle Sole Suffix/Variable Input ---
    // If the *original* input was just a suffix number (e.g., '5k') or a variable ('ipt')
    // and math evaluation failed (e.g., due to safety regex), try parsing the processed value directly.
    // This relies on the preprocessing steps having converted it to a plain number.
    if (/^[+-]?\d*\.?\d+[kmbt]$/i.test(value) || /^[a-z]+$/i.test(value)){
         const finalProcessedNum = parseFloat(processedValue);
         if (!isNaN(finalProcessedNum)) {
            return finalProcessedNum;
         }
    }

    return null; // Return null if no valid parsing method worked
}

/**
 * Handles the input event for live formatting.
 */
function handleInput() {
    const selectionStart = numberInput.selectionStart;
    const selectionEnd = numberInput.selectionEnd;
    const originalLength = numberInput.value.length;

    let value = numberInput.value;
    
    // Check if the value contains a math operator before processing
    const containsOperator = /[+\-*\/]/.test(value) && !/^-\d/.test(value); // Exclude negative numbers
    
    // If it contains an operator, don't process it for formatting (calculation mode)
    if (containsOperator) {
        showLiveResult(value);
        return;
    }
    
    // For decimal numbers, keep the decimal point structure intact
    if (value.includes('.')) {
        const parsedForStorage = parseInput(value);
        if (parsedForStorage !== null) {
            numberInput.setAttribute(rawValueAttribute, parsedForStorage);
        } else {
            numberInput.setAttribute(rawValueAttribute, value.replace(/,/g, ''));
        }
        showLiveResult(value);
        return;
    }
    
    // For regular numbers or shortcuts without decimals
    let rawNumericString = value.replace(/[^\d.]/g, '');
    
    // Store the raw value
    const parsedForStorage = parseInput(value);
    if (parsedForStorage !== null) {
        numberInput.setAttribute(rawValueAttribute, parsedForStorage);
    } else {
        numberInput.setAttribute(rawValueAttribute, rawNumericString);
    }

    // Only format if it's a plain number without operators
    if (/^[-]?\d*[\.,]?\d*$/.test(value.replace(/,/g, '')) && !/[+\-*\/]$/.test(value)) {
        let formattedValue = formatNumberWithCommas(rawNumericString);
        if (formattedValue !== value) {
            numberInput.value = formattedValue;
            const newLength = formattedValue.length;
            const lengthDiff = newLength - originalLength;
            if (selectionStart !== null && selectionEnd !== null) {
                const newStart = selectionStart + lengthDiff > newLength ? newLength : selectionStart + lengthDiff;
                const newEnd = selectionEnd + lengthDiff > newLength ? newLength : selectionEnd + lengthDiff;
                numberInput.setSelectionRange(Math.max(0, newStart), Math.max(0, newEnd));
            }
        }
    }

    showLiveResult(value);
}

/**
 * Handles the blur (focus lost) event and Enter key press for final evaluation.
 */
function handleEvaluation() {
    const currentValue = numberInput.value;
    const parsedValue = parseInput(currentValue);

    if (parsedValue !== null) {
        numberInput.value = formatNumberWithCommas(parsedValue);
        numberInput.setAttribute(rawValueAttribute, parsedValue);
    } else {
        // If parsing fails, maybe clear the input or leave the invalid entry?
        // For now, leave it, but store empty raw value
        // numberInput.value = ''; // Option to clear invalid input
        numberInput.setAttribute(rawValueAttribute, '');
    }
    // Hide the live result after evaluation
    liveResultDiv.textContent = '';
    liveResultDiv.style.display = 'none';
}

function showLiveResult(value) {
    // Only show if the live calculation feature is enabled and an operator is present
    if (!showLiveCalculationEnabled) {
        liveResultDiv.style.display = 'none';
        return;
    }
    
    // Only show if an operator is present and input is not empty, but ignore leading minus for negative numbers
    if (value && /[+*/]/.test(value) || (value && /-/.test(value.slice(1)))) {
        // Check for operator not at the first character
        const hasOperator = /[+*/]/.test(value) || /-/.test(value.slice(1));
        if (hasOperator) {
            const result = parseInput(value);
            if (result !== null && !isNaN(result)) {
                liveResultDiv.textContent = '= ' + formatNumberWithCommas(result);
                liveResultDiv.style.display = 'block';
            } else {
                liveResultDiv.textContent = '';
                liveResultDiv.style.display = 'none';
            }
            return;
        }
    }
    liveResultDiv.textContent = '';
    liveResultDiv.style.display = 'none';
}

// --- Attach Event Listeners ---

// Live formatting on input
numberInput.addEventListener('input', handleInput);

// Final evaluation on blur
numberInput.addEventListener('blur', handleEvaluation);

// Final evaluation on Enter key press
numberInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault(); // Prevent form submission if inside a form
        handleEvaluation();
        numberInput.blur(); // Optionally remove focus after Enter
    }
});

// Toggle for live calculation display
if (toggleLiveCalculation) {
    toggleLiveCalculation.addEventListener('change', function() {
        showLiveCalculationEnabled = this.checked;
        if (!showLiveCalculationEnabled) {
            liveResultDiv.style.display = 'none';
        } else {
            // Re-evaluate current input to show the result if applicable
            showLiveResult(numberInput.value);
        }
    });
    // Set initial state
    showLiveCalculationEnabled = toggleLiveCalculation.checked;
}

// Function to update quick buttons visibility based on current settings
function updateQuickButtonsVisibility() {
    if (!quickButtonsEnabled) {
        quickButtonsContainer.style.display = 'none';
        return;
    }
    
    if (quickButtonsVisibilityMode === 'always') {
        quickButtonsContainer.style.display = 'flex';
    } else if (quickButtonsVisibilityMode === 'focus') {
        // When in focus mode, visibility is handled by the focus/blur events on the input
        if (document.activeElement === numberInput) {
            quickButtonsContainer.style.display = 'flex';
        } else {
            quickButtonsContainer.style.display = 'none';
        }
    }
}

// Toggle for quick buttons
if (toggleQuickButtons) {
    toggleQuickButtons.addEventListener('change', function() {
        quickButtonsEnabled = this.checked;
        updateQuickButtonsVisibility();
    });
    // Set initial state
    quickButtonsEnabled = toggleQuickButtons.checked;
}

// Radio buttons for visibility mode
if (alwaysVisibleOption && focusVisibleOption) {
    alwaysVisibleOption.addEventListener('change', function() {
        if (this.checked) {
            quickButtonsVisibilityMode = 'always';
            updateQuickButtonsVisibility();
        }
    });
    
    focusVisibleOption.addEventListener('change', function() {
        if (this.checked) {
            quickButtonsVisibilityMode = 'focus';
            updateQuickButtonsVisibility();
        }
    });
    
    // Set initial state from radio buttons
    quickButtonsVisibilityMode = alwaysVisibleOption.checked ? 'always' : 'focus';
}

// Add focus and blur events to the input field for focus visibility mode
numberInput.addEventListener('focus', function() {
    if (quickButtonsEnabled && quickButtonsVisibilityMode === 'focus') {
        quickButtonsContainer.style.display = 'flex';
    }
});

numberInput.addEventListener('blur', function() {
    if (quickButtonsEnabled && quickButtonsVisibilityMode === 'focus') {
        // Add a small delay to allow button clicks to register
        setTimeout(() => {
            // Only hide if we're not currently clicking a quick button
            if (!isClickingQuickButton) {
                quickButtonsContainer.style.display = 'none';
            }
        }, 150);
    }
});

// Initialize visibility based on current settings
updateQuickButtonsVisibility(); 