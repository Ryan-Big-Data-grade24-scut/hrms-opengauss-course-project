export const meta = {
  name: 'redesign-hrms',
  description: 'Research user needs, design API + frontend, peer review, then implement',
  phases: [
    { title: 'Research', detail: 'User needs from four forces + web search' },
    { title: 'Design', detail: 'API endpoints and frontend architecture' },
    { title: 'Review', detail: 'Peer review of designs' },
  ],
}

const REQUESTS_SCHEMA = {
  type: 'object',
  properties: {
    requirements: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          role: { type: 'string', enum: ['HR', 'Manager', 'Employee'] },
          scenario: { type: 'string' },
          need: { type: 'string' },
          priority: { type: 'string', enum: ['P0', 'P1', 'P2'] },
        },
        required: ['id', 'role', 'scenario', 'need', 'priority'],
      },
    },
  },
  required: ['requirements'],
}

const DESIGN_SCHEMA = {
  type: 'object',
  properties: {
    apis: { type: 'array', items: { type: 'object' } },
    pages: { type: 'array', items: { type: 'object' } },
  },
  required: ['apis', 'pages'],
}

// =============================================
// Phase 1: Research user needs
// =============================================
phase('Research')
log('Starting user needs research...')

const [needsFromDocs, needsFromWeb] = await Promise.all([
  agent(
    'Read E:/Ufolder/Current/ActionSys/Hgclass/DB_proj/prior/v6/为什么需要一个人事部门.md and extract: 1) The four forces framework 2) What problems HR/Manager/Employee users face. Then produce a structured list of 3-5 core user needs. Each need must have: role (HR/Manager/Employee), a concrete scenario sentence, a need sentence starting with "I need to", and a priority (P0/P1/P2).',
    { label: 'Extract from framework', phase: 'Research', schema: REQUESTS_SCHEMA }
  ),
  agent(
    'Search the web for: what are the biggest pain points for HR managers and employees using HR management systems? What features do they actually use daily? What do they complain about? Focus on: attrition prediction, talent matching, skills tracking, org network analysis. Return 3-5 concrete user needs with the same structure: role, scenario, need, priority.',
    { label: 'Web research pain points', phase: 'Research', schema: REQUESTS_SCHEMA }
  ),
])

log(`Found ${needsFromDocs?.requirements?.length || 0} needs from docs, ${needsFromWeb?.requirements?.length || 0} from web`)

// Reviewer merges
const merged = await agent(
  `Merge these two lists of HRMS user requirements into one unified, deduplicated, priority-sorted list.
   Keep at most 6 requirements. For each, suggest what API endpoint it maps to and what page it needs.
   List A: ${JSON.stringify(needsFromDocs?.requirements || [])}
   List B: ${JSON.stringify(needsFromWeb?.requirements || [])}
   Output format: for each requirement: id, role, scenario, need, priority, suggestedAPI, suggestedPage`,
  { label: 'Reviewer: merge needs', phase: 'Review' }
)

log('Reviewer output:', merged?.substring(0, 500))

// =============================================
// Phase 2: Design API + Frontend
// =============================================
phase('Design')
log('Starting parallel design...')

const [apiDesign, frontendDesign] = await Promise.all([
  agent(
    `Based on these requirements, design the backend REST API.
     Requirements: ${merged}
     Context: openGauss 7.0 with DB4AI (ML), DataVec (vectors), Apache AGE (graphs).
     Existing backend at E:/Ufolder/Current/ActionSys/Hgclass/DB/backend/src/server.py (Python BaseHTTPRequestHandler).
     Existing API pattern: /api/{resource} with GET/POST/PUT/DELETE.
     Design the NEW API endpoints needed. Keep it minimal - max 8 endpoints.
     For each endpoint specify: method, path, input params, output format, which openGauss feature it uses.
     Focus on: attrition prediction, talent matching, org network, skills management.`,
    { label: 'API design agent', phase: 'Design', schema: DESIGN_SCHEMA }
  ),
  agent(
    `Based on these requirements, design the frontend UI architecture.
     Requirements: ${merged}
     Design 3-5 pages maximum. Each page must be simple: one main action, one secondary action.
     Use shadcn/ui for React or Naive UI for Vue components.
     The design must be MODERN and MINIMAL - not enterprise-bloated.
     For each page specify: route, page title, main component type, data dependencies (which API endpoints).
     Keep it SIMPLE - no tabs, no complex filters. One table or one dashboard per page.`,
    { label: 'Frontend design agent', phase: 'Design', schema: DESIGN_SCHEMA }
  ),
])

log(`APIs designed: ${apiDesign?.apis?.length || 0}, Pages designed: ${frontendDesign?.pages?.length || 0}`)

// =============================================
// Phase 3: Peer Review
// =============================================
phase('Review')
log('Running peer review...')

const review = await agent(
  `Review these two designs for CONSISTENCY.
   API Design: ${JSON.stringify(apiDesign?.apis || [])}
   Frontend Design: ${JSON.stringify(frontendDesign?.pages || [])}
   Check: 1) Does every frontend page have the APIs it needs? 2) Does every API endpoint have a page that uses it? 3) Is there any overlap or missing functionality?
   Provide: a list of issues found (max 5), and a final verdict: APPROVED or CHANGES_NEEDED.`,
  { label: 'Meta-reviewer: consistency check', phase: 'Review' }
)

log('Review verdict:', review?.substring(0, 300))

// =============================================
// Output
// =============================================
return {
  requirements: merged,
  apiDesign: apiDesign?.apis || [],
  frontendDesign: frontendDesign?.pages || [],
  reviewVerdict: review,
}
