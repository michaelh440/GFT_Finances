// src/routes/hsi/registrations/+page.server.js
import sql from '$lib/db';

export const load = async () => {
  try {
    // Overall funnel counts
    const funnelData = await sql`
      WITH student_classes AS (
        SELECT DISTINCT student_id, class_code
        FROM registrations
        WHERE class_code IN ('CT1', 'CT2', 'CT3', 'AGT1')
      ),
      ct1_students AS (SELECT student_id FROM student_classes WHERE class_code = 'CT1'),
      ct2_students AS (SELECT student_id FROM student_classes WHERE class_code = 'CT2'),
      ct3_students AS (SELECT student_id FROM student_classes WHERE class_code = 'CT3'),
      agt1_students AS (SELECT student_id FROM student_classes WHERE class_code = 'AGT1')
      SELECT
        (SELECT COUNT(*) FROM ct1_students) AS ct1_total,
        (SELECT COUNT(*) FROM ct2_students) AS ct2_total,
        (SELECT COUNT(*) FROM ct3_students) AS ct3_total,
        (SELECT COUNT(*) FROM agt1_students) AS agt1_total,
        (SELECT COUNT(*) FROM ct1_students WHERE student_id NOT IN (SELECT student_id FROM ct2_students)) AS ct1_not_ct2,
        (SELECT COUNT(*) FROM ct1_students WHERE student_id IN (SELECT student_id FROM ct2_students)) AS ct1_to_ct2,
        (SELECT COUNT(*) FROM ct2_students WHERE student_id NOT IN (SELECT student_id FROM ct3_students)) AS ct2_not_ct3,
        (SELECT COUNT(*) FROM ct2_students WHERE student_id IN (SELECT student_id FROM ct3_students)) AS ct2_to_ct3,
        (SELECT COUNT(*) FROM ct3_students WHERE student_id NOT IN (SELECT student_id FROM agt1_students)) AS ct3_not_agt1,
        (SELECT COUNT(*) FROM ct3_students WHERE student_id IN (SELECT student_id FROM agt1_students)) AS ct3_to_agt1
    `;

    // Monthly breakdown - students who took the first class in the pair, grouped by their registration month for that class
    const monthlyFunnel = await sql`
      WITH student_classes AS (
        SELECT DISTINCT student_id, class_code
        FROM registrations
        WHERE class_code IN ('CT1', 'CT2', 'CT3', 'AGT1')
      ),
      ct2_students AS (SELECT student_id FROM student_classes WHERE class_code = 'CT2'),
      ct3_students AS (SELECT student_id FROM student_classes WHERE class_code = 'CT3'),
      agt1_students AS (SELECT student_id FROM student_classes WHERE class_code = 'AGT1'),
      -- Get earliest registration date per student per class
      earliest_reg AS (
        SELECT student_id, class_code, MIN(registration_date) AS first_reg_date
        FROM registrations
        WHERE class_code IN ('CT1', 'CT2', 'CT3')
        GROUP BY student_id, class_code
      )
      SELECT
        DATE_TRUNC('month', er.first_reg_date)::DATE AS reg_month,
        er.class_code,
        COUNT(*) AS total_students,
        COUNT(*) FILTER (WHERE
          (er.class_code = 'CT1' AND er.student_id NOT IN (SELECT student_id FROM ct2_students))
          OR (er.class_code = 'CT2' AND er.student_id NOT IN (SELECT student_id FROM ct3_students))
          OR (er.class_code = 'CT3' AND er.student_id NOT IN (SELECT student_id FROM agt1_students))
        ) AS did_not_continue,
        COUNT(*) FILTER (WHERE
          (er.class_code = 'CT1' AND er.student_id IN (SELECT student_id FROM ct2_students))
          OR (er.class_code = 'CT2' AND er.student_id IN (SELECT student_id FROM ct3_students))
          OR (er.class_code = 'CT3' AND er.student_id IN (SELECT student_id FROM agt1_students))
        ) AS continued
      FROM earliest_reg er
      GROUP BY DATE_TRUNC('month', er.first_reg_date), er.class_code
      ORDER BY reg_month ASC, er.class_code ASC
    `;

    return {
      funnel: funnelData[0] ? {
        ct1_total: Number(funnelData[0].ct1_total),
        ct2_total: Number(funnelData[0].ct2_total),
        ct3_total: Number(funnelData[0].ct3_total),
        agt1_total: Number(funnelData[0].agt1_total),
        ct1_not_ct2: Number(funnelData[0].ct1_not_ct2),
        ct1_to_ct2: Number(funnelData[0].ct1_to_ct2),
        ct2_not_ct3: Number(funnelData[0].ct2_not_ct3),
        ct2_to_ct3: Number(funnelData[0].ct2_to_ct3),
        ct3_not_agt1: Number(funnelData[0].ct3_not_agt1),
        ct3_to_agt1: Number(funnelData[0].ct3_to_agt1)
      } : null,
      monthlyFunnel: monthlyFunnel.map(r => ({
        reg_month: r.reg_month.toISOString().split('T')[0],
        class_code: r.class_code,
        total_students: Number(r.total_students),
        did_not_continue: Number(r.did_not_continue),
        continued: Number(r.continued)
      }))
    };
  } catch (error) {
    console.error('Error loading registration funnel data:', error);
    return {
      funnel: null,
      monthlyFunnel: []
    };
  }
};