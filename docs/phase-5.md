# Phase 5: PA/TA configuration

Admin > PA/TA allocations provides semester selection, per-course PA/TA slots, semester-wide AED amounts and application dates. Saving is transactional and records before/after audit data. Draft and active semesters can be edited; archived and finalized semesters remain read-only.

Faculty see amounts and their own course allocations without edit controls. Students see active-semester courses with allocated positions and assistantship amounts. These are allocation previews; eligibility and application submission are later phases.

Validation rejects negative/fractional slots, invalid dates, amounts over two decimal places, duplicate or mismatched course lists, and reductions below active appointments. Existing schema is reused; no migration or credential change is required.

Validation: 30 backend tests pass, including five new allocation tests; production frontend build passes. Tests use embedded PostgreSQL. Standalone PostgreSQL deployment remains unverified. Future appointment creation must lock the semester consistently with allocation updates to enforce concurrent capacity rules.
