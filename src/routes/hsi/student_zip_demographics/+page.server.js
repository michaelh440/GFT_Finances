// src/routes/hsi/student_zip_demographics/+page.server.js
import sql from '$lib/db';
import { requirePermission } from '$lib/guards.js';

const CENSUS_API_BASE = 'https://api.census.gov/data';
const ACS_YEAR = 2022; // Most recent stable ACS 5-year estimates

// ACS variable codes we need
// See: https://api.census.gov/data/2022/acs/acs5/variables.json
// ACS variable codes split into two batches (Census API limit: 50 per request)
// Batch 1: Population, age brackets
const ACS_VARS_1 = [
    'B01003_001E', // Total population
    'B01002_001E', // Median age
    // Age brackets - male
    'B01001_003E','B01001_004E','B01001_005E','B01001_006E', // Male under 18
    'B01001_027E','B01001_028E','B01001_029E','B01001_030E', // Female under 18
    'B01001_007E','B01001_008E','B01001_031E','B01001_032E', // M/F 18-21
    'B01001_009E','B01001_010E','B01001_033E','B01001_034E', // M/F 22-24
    'B01001_011E','B01001_012E','B01001_035E','B01001_036E', // M/F 25-34
    'B01001_013E','B01001_014E','B01001_037E','B01001_038E', // M/F 35-44
    'B01001_015E','B01001_016E','B01001_039E','B01001_040E', // M/F 45-54
    'B01001_017E','B01001_018E','B01001_041E','B01001_042E', // M/F 55-64
    'B01001_020E','B01001_021E','B01001_022E','B01001_023E','B01001_024E','B01001_025E', // Male 65+
    'B01001_044E','B01001_045E','B01001_046E','B01001_047E','B01001_048E','B01001_049E', // Female 65+
].join(',');

// Batch 2: Income, education, household
const ACS_VARS_2 = [
    // Median household income
    'B19013_001E',
    // Income brackets
    'B19001_001E','B19001_002E','B19001_003E','B19001_004E','B19001_005E',
    'B19001_006E','B19001_007E','B19001_008E','B19001_009E','B19001_010E',
    'B19001_011E','B19001_012E','B19001_013E','B19001_014E','B19001_015E',
    'B19001_016E','B19001_017E',
    // Education (population 25+)
    'B15003_001E','B15003_017E','B15003_018E','B15003_019E','B15003_020E',
    'B15003_021E','B15003_022E','B15003_023E','B15003_024E','B15003_025E',
    // Homeownership + household size
    'B25003_001E','B25003_002E','B25010_001E',
].join(',');

async function fetchCensusForZip(zipCode) {
    const geo = `for=zip%20code%20tabulation%20area:${zipCode}`;
    const base = `${CENSUS_API_BASE}/${ACS_YEAR}/acs/acs5`;

    const [res1, res2] = await Promise.all([
        fetch(`${base}?get=${ACS_VARS_1}&${geo}`),
        fetch(`${base}?get=${ACS_VARS_2}&${geo}`)
    ]);

    if (!res1.ok) {
        const body = await res1.text();
        console.error(`[Census] Batch1 ${res1.status} for ZIP ${zipCode}:`, body.slice(0, 200));
        throw new Error(`Census API error for ZIP ${zipCode}: ${res1.status} — ${body.slice(0, 150)}`);
    }
    if (!res2.ok) {
        const body = await res2.text();
        console.error(`[Census] Batch2 ${res2.status} for ZIP ${zipCode}:`, body.slice(0, 200));
        throw new Error(`Census API error for ZIP ${zipCode}: ${res2.status} — ${body.slice(0, 150)}`);
    }

    const [data1, data2] = await Promise.all([res1.json(), res2.json()]);

    if (!data1 || data1.length < 2 || !data2 || data2.length < 2) return null;

    // Merge both responses into one flat lookup object
    const merged = {};
    const headers1 = data1[0]; const row1 = data1[1];
    const headers2 = data2[0]; const row2 = data2[1];
    headers1.forEach((h, i) => { merged[h] = row1[i]; });
    headers2.forEach((h, i) => { merged[h] = row2[i]; });

    const get = (v) => { const n = parseInt(merged[v], 10); return isNaN(n) || n < 0 ? null : n; };
    const getFloat = (v) => { const n = parseFloat(merged[v]); return isNaN(n) || n < 0 ? null : n; };

    const totalPop = get('B01003_001E') || 1;
    const totalHH  = get('B19001_001E') || 1;
    const totalEdu = get('B15003_001E') || 1;
    const totalHousing = get('B25003_001E') || 1;

    const sumVars = (...vars) => vars.reduce((s, v) => s + (get(v) || 0), 0);
    const pct    = (n) => totalPop   > 0 ? +((n / totalPop)   * 100).toFixed(2) : null;
    const pctHH  = (n) => totalHH    > 0 ? +((n / totalHH)    * 100).toFixed(2) : null;
    const pctEdu = (n) => totalEdu   > 0 ? +((n / totalEdu)   * 100).toFixed(2) : null;

    const under18  = sumVars('B01001_003E','B01001_004E','B01001_005E','B01001_006E','B01001_027E','B01001_028E','B01001_029E','B01001_030E');
    const age18_24 = sumVars('B01001_007E','B01001_008E','B01001_009E','B01001_010E','B01001_031E','B01001_032E','B01001_033E','B01001_034E');
    const age25_34 = sumVars('B01001_011E','B01001_012E','B01001_035E','B01001_036E');
    const age35_44 = sumVars('B01001_013E','B01001_014E','B01001_037E','B01001_038E');
    const age45_54 = sumVars('B01001_015E','B01001_016E','B01001_039E','B01001_040E');
    const age55_64 = sumVars('B01001_017E','B01001_018E','B01001_041E','B01001_042E');
    const age65plus = sumVars('B01001_020E','B01001_021E','B01001_022E','B01001_023E','B01001_024E','B01001_025E','B01001_044E','B01001_045E','B01001_046E','B01001_047E','B01001_048E','B01001_049E');

    const inc_under_25k  = sumVars('B19001_002E','B19001_003E','B19001_004E','B19001_005E');
    const inc_25k_50k    = sumVars('B19001_006E','B19001_007E','B19001_008E','B19001_009E','B19001_010E');
    const inc_50k_75k    = sumVars('B19001_011E','B19001_012E');
    const inc_75k_100k   = get('B19001_013E') || 0;
    const inc_100k_150k  = sumVars('B19001_014E','B19001_015E');
    const inc_150k_plus  = sumVars('B19001_016E','B19001_017E');

    const edu_hs           = sumVars('B15003_017E','B15003_018E');
    const edu_some_college = sumVars('B15003_019E','B15003_020E','B15003_021E');
    const edu_bachelors    = get('B15003_022E') || 0;
    const edu_graduate     = sumVars('B15003_023E','B15003_024E','B15003_025E');

    console.log(`[Census] ${zipCode} OK — pop: ${totalPop}, median age: ${getFloat('B01002_001E')}, median income: ${get('B19013_001E')}`);

    return {
        zip_code: zipCode,
        total_population: totalPop,
        median_age: getFloat('B01002_001E'),
        pct_age_under_18: pct(under18),
        pct_age_18_24:    pct(age18_24),
        pct_age_25_34:    pct(age25_34),
        pct_age_35_44:    pct(age35_44),
        pct_age_45_54:    pct(age45_54),
        pct_age_55_64:    pct(age55_64),
        pct_age_65_plus:  pct(age65plus),
        median_household_income: get('B19013_001E'),
        pct_income_under_25k:  pctHH(inc_under_25k),
        pct_income_25k_50k:    pctHH(inc_25k_50k),
        pct_income_50k_75k:    pctHH(inc_50k_75k),
        pct_income_75k_100k:   pctHH(inc_75k_100k),
        pct_income_100k_150k:  pctHH(inc_100k_150k),
        pct_income_150k_plus:  pctHH(inc_150k_plus),
        pct_edu_high_school:   pctEdu(edu_hs),
        pct_edu_some_college:  pctEdu(edu_some_college),
        pct_edu_bachelors:     pctEdu(edu_bachelors),
        pct_edu_graduate:      pctEdu(edu_graduate),
        pct_owner_occupied: totalHousing > 0
            ? +(((get('B25003_002E') || 0) / totalHousing) * 100).toFixed(2)
            : null,
        avg_household_size: getFloat('B25010_001E'),
        acs_year: ACS_YEAR,
        last_updated: new Date()
    };
}


export async function load({ locals, url }) {
    requirePermission(locals.user, 'hsi', 'manager');

    // --- Parse filter params from URL ---
    const years    = url.searchParams.getAll('year').filter(Boolean);
    const classes  = url.searchParams.getAll('class').filter(Boolean);
    const tracks   = url.searchParams.getAll('track').filter(Boolean);
    const teachers = url.searchParams.getAll('teacher').filter(Boolean);

    const hasFilters = years.length || classes.length || tracks.length || teachers.length;

    // --- Load filter options ---
    const filterYears = await sql`
        SELECT DISTINCT EXTRACT(YEAR FROM cs.start_date)::int AS year
        FROM registrations r
        JOIN class_sessions cs ON r.session_id = cs.session_id
        WHERE cs.start_date IS NOT NULL
        ORDER BY year DESC
    `;

    const filterClasses = await sql`
        SELECT class_code, class_name, track
        FROM classes
        WHERE is_active = true
        ORDER BY track, class_name
    `;

    const filterTracks = await sql`
        SELECT DISTINCT track
        FROM classes
        WHERE track IS NOT NULL AND track != '' AND is_active = true
        ORDER BY track
    `;

    const filterTeachers = await sql`
        SELECT teacher_id, first_name || ' ' || last_name AS name
        FROM teachers
        WHERE is_active = true
        ORDER BY last_name, first_name
    `;

    // --- Build filtered student ID set ---
    // All analytics queries below join against this CTE when filters are active
    // The CTE finds students whose LAST class session matches all active filters
    const buildStudentFilter = () => {
        if (!hasFilters) return '';

        const conditions = [];
        if (years.length)    conditions.push(`EXTRACT(YEAR FROM cs.start_date) = ANY(ARRAY[${years.map(Number).join(',')}])`);
        if (classes.length)  conditions.push(`cs.class_code = ANY(ARRAY[${classes.map(c => `'${c.replace(/'/g,"''")}'`).join(',')}])`);
        if (tracks.length)   conditions.push(`cl.track = ANY(ARRAY[${tracks.map(t => `'${t.replace(/'/g,"''")}'`).join(',')}])`);
        if (teachers.length) conditions.push(`cs.teacher_id = ANY(ARRAY[${teachers.map(Number).join(',')}])`);

        return `
            WITH filtered_students AS (
                SELECT DISTINCT r.student_id
                FROM registrations r
                JOIN class_sessions cs ON r.session_id = cs.session_id
                JOIN classes cl ON cs.class_code = cl.class_code
                WHERE ${conditions.join(' AND ')}
            )
        `;
    };

    const studentJoin = hasFilters
        ? 'JOIN filtered_students fs ON s.student_id = fs.student_id'
        : '';

    const cte = buildStudentFilter();

    // --- Filtered queries ---
    const studentZips = await sql.unsafe(`
        ${cte}
        SELECT DISTINCT s.zip_code, COUNT(*) AS student_count
        FROM students s
        ${studentJoin}
        WHERE s.zip_code IS NOT NULL AND s.zip_code ~ '^[0-9]{5}$'
        GROUP BY s.zip_code
        ORDER BY student_count DESC
    `);

    const demographics = await sql.unsafe(`
        ${cte}
        SELECT zd.*, counts.student_count
        FROM student_zip_demographics zd
        JOIN (
            SELECT s.zip_code, COUNT(*) AS student_count
            FROM students s
            ${studentJoin}
            WHERE s.zip_code IS NOT NULL AND s.zip_code ~ '^[0-9]{5}$'
            GROUP BY s.zip_code
        ) counts ON counts.zip_code = zd.zip_code
        ORDER BY counts.student_count DESC
    `);

    const [summary] = await sql.unsafe(`
        ${cte}
        SELECT
            COUNT(DISTINCT s.student_id) AS students_with_zip,
            COUNT(DISTINCT s.zip_code) AS unique_zips,
            COUNT(DISTINCT zd.zip_code) AS zips_with_census_data,
            ROUND(AVG(zd.median_household_income)) AS avg_median_income,
            ROUND(AVG(zd.median_age), 1) AS avg_median_age,
            ROUND(AVG(zd.pct_edu_bachelors + zd.pct_edu_graduate), 1) AS avg_pct_college_degree
        FROM students s
        ${studentJoin}
        LEFT JOIN student_zip_demographics zd ON s.zip_code = zd.zip_code
        WHERE s.zip_code IS NOT NULL AND s.zip_code ~ '^[0-9]{5}$'
    `);

    const genderBreakdown = await sql.unsafe(`
        ${cte}
        SELECT gender, COUNT(*) AS count
        FROM students s
        ${studentJoin}
        WHERE gender IS NOT NULL AND gender != ''
        GROUP BY gender
        ORDER BY count DESC
    `);

    const ageBreakdown = await sql.unsafe(`
        ${cte}
        SELECT
            CASE
                WHEN age < 18 THEN 'Under 18'
                WHEN age BETWEEN 18 AND 24 THEN '18-24'
                WHEN age BETWEEN 25 AND 34 THEN '25-34'
                WHEN age BETWEEN 35 AND 44 THEN '35-44'
                WHEN age BETWEEN 45 AND 54 THEN '45-54'
                WHEN age BETWEEN 55 AND 64 THEN '55-64'
                WHEN age >= 65 THEN '65+'
                ELSE 'Unknown'
            END AS age_bracket,
            COUNT(*) AS count
        FROM students s
        ${studentJoin}
        WHERE age IS NOT NULL
        GROUP BY age_bracket
        ORDER BY MIN(age)
    `);

    return {
        studentZips, demographics, summary, genderBreakdown, ageBreakdown,
        filterOptions: { years: filterYears, classes: filterClasses, tracks: filterTracks, teachers: filterTeachers },
        activeFilters: { years, classes, tracks, teachers }
    };
}


export const actions = {
    refresh: async ({ locals }) => {
        requirePermission(locals.user, 'hsi', 'manager');

        // Step 1: Diagnostic — check ZIP population in students table
        const [zipStats] = await sql`
            SELECT
                COUNT(*) AS total_students,
                COUNT(zip_code) AS students_with_zip,
                COUNT(CASE WHEN zip_code ~ '^[0-9]{5}$' THEN 1 END) AS students_with_valid_zip
            FROM students
        `;
        console.log('[Demographics Refresh] ZIP stats from students table:', JSON.stringify(zipStats));

        // Step 2: Get unique valid ZIPs
        const zipRows = await sql`
            SELECT DISTINCT zip_code
            FROM students
            WHERE zip_code IS NOT NULL AND zip_code ~ '^[0-9]{5}$'
        `;
        console.log(`[Demographics Refresh] Unique valid ZIPs found: ${zipRows.length}`, zipRows.map(r => r.zip_code));

        const results = { success: 0, failed: 0, errors: [] };

        if (zipRows.length === 0) {
            const msg = `No valid ZIPs found. Stats: ${JSON.stringify(zipStats)}`;
            console.warn('[Demographics Refresh]', msg);
            results.errors.push(msg);
            return { refreshResult: results };
        }

        for (const { zip_code } of zipRows) {
            try {
                console.log(`[Demographics Refresh] Calling Census API for ZIP: ${zip_code}`);

                const demo = await fetchCensusForZip(zip_code);

                if (!demo) {
                    console.warn(`[Demographics Refresh] No Census data returned for ZIP: ${zip_code}`);
                    results.failed++;
                    results.errors.push(`${zip_code}: Census API returned no data`);
                    continue;
                }

                console.log(`[Demographics Refresh] Census data for ${zip_code} — pop: ${demo.total_population}, median age: ${demo.median_age}, median income: ${demo.median_household_income}`);

                // postgres.js object insert: sql(demo) parameterizes all values safely
                await sql`
                    INSERT INTO student_zip_demographics ${sql(demo)}
                    ON CONFLICT (zip_code) DO UPDATE SET
                        total_population = EXCLUDED.total_population,
                        median_age = EXCLUDED.median_age,
                        pct_age_under_18 = EXCLUDED.pct_age_under_18,
                        pct_age_18_24 = EXCLUDED.pct_age_18_24,
                        pct_age_25_34 = EXCLUDED.pct_age_25_34,
                        pct_age_35_44 = EXCLUDED.pct_age_35_44,
                        pct_age_45_54 = EXCLUDED.pct_age_45_54,
                        pct_age_55_64 = EXCLUDED.pct_age_55_64,
                        pct_age_65_plus = EXCLUDED.pct_age_65_plus,
                        median_household_income = EXCLUDED.median_household_income,
                        pct_income_under_25k = EXCLUDED.pct_income_under_25k,
                        pct_income_25k_50k = EXCLUDED.pct_income_25k_50k,
                        pct_income_50k_75k = EXCLUDED.pct_income_50k_75k,
                        pct_income_75k_100k = EXCLUDED.pct_income_75k_100k,
                        pct_income_100k_150k = EXCLUDED.pct_income_100k_150k,
                        pct_income_150k_plus = EXCLUDED.pct_income_150k_plus,
                        pct_edu_high_school = EXCLUDED.pct_edu_high_school,
                        pct_edu_some_college = EXCLUDED.pct_edu_some_college,
                        pct_edu_bachelors = EXCLUDED.pct_edu_bachelors,
                        pct_edu_graduate = EXCLUDED.pct_edu_graduate,
                        pct_owner_occupied = EXCLUDED.pct_owner_occupied,
                        avg_household_size = EXCLUDED.avg_household_size,
                        acs_year = EXCLUDED.acs_year,
                        last_updated = EXCLUDED.last_updated
                `;

                console.log(`[Demographics Refresh] Successfully upserted ZIP: ${zip_code}`);
                results.success++;
                await new Promise(r => setTimeout(r, 150));

            } catch (err) {
                console.error(`[Demographics Refresh] Error for ZIP ${zip_code}:`, err);
                results.failed++;
                results.errors.push(`${zip_code}: ${err.message}`);
            }
        }

        console.log(`[Demographics Refresh] Complete. Success: ${results.success}, Failed: ${results.failed}`);
        return { refreshResult: results };
    },

    diagnose: async ({ locals }) => {
        requirePermission(locals.user, 'hsi', 'manager');

        // Sample raw ZIP values to see exactly what's stored
        const samples = await sql`
            SELECT zip_code, length(zip_code) AS len,
                   ascii(substring(zip_code, 1, 1)) AS first_char_ascii,
                   ascii(substring(zip_code, length(zip_code), 1)) AS last_char_ascii
            FROM students
            WHERE zip_code IS NOT NULL
            LIMIT 20
        `;
        console.log('[ZIP Diagnose] Sample ZIP values:', JSON.stringify(samples, null, 2));

        // Count by length
        const byLength = await sql`
            SELECT length(zip_code) AS len, COUNT(*) AS count,
                   MIN(zip_code) AS example
            FROM students
            WHERE zip_code IS NOT NULL
            GROUP BY length(zip_code)
            ORDER BY count DESC
        `;
        console.log('[ZIP Diagnose] ZIPs by length:', JSON.stringify(byLength, null, 2));

        return { diagnoseResult: { samples, byLength } };
    }
};