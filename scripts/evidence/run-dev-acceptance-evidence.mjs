// Updated run-dev-acceptance-evidence.mjs

// ... rest of your code above

async function assertionHelpers() {
    try {
        // existing logic
    } catch (error) {
        throw new Error(`Assertion error: ${error.message}`);
    }
}

async function apiRequest() {
    try {
        // existing logic
    } catch (error) {
        throw new Error(`API request failed: ${error.message}`);
    }
}

async function run() {
    const results = [];
    const ACs = [AC_001, AC_002]; // your acceptance criteria functions

    try {
        for (const ac of ACs) {
            const status = await ac(); // running each acceptance criterion
            results.push(status);
        }
    } catch (error) {
        console.error(error);
    } finally {
        // Final output generation
        // Create your output files artifacts/dev-acceptance-trace.json, artifacts/dev-acceptance-summary.json, operations/evidence/acceptance-run-output-dev.yaml
        // Use existing output schemas, adjusting for counts and failed status
        if (results.some(result => result.status === 'FAIL')) {
            process.exit(1);
        }
    }
}

// ... rest of your code below
