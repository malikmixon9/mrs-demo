/* Seed data for the MRS Client Management prototype.
   ALL FAKE. No real people, no real SSNs. Field names mirror Terri's spec
   (Master Client Tracker, Coach Dashboard, Supervisor Dashboard, Progress Log). */

const COACHES = ["Denise Carter", "Marcus Hill", "Angela Reed"];

const SERVICE_TYPES = ["WBLE", "Job Coaching", "Job Development", "Assessment"];

// Progress is DERIVED from the log. authorizedHours is fixed by MRS;
// hoursDelivered and % complete are computed in app.js from progressLog entries.
const CLIENTS = [
  {
    id: "c1", name: "Jaymar Ellis", authNumber: "MRS-204871",
    ssn: "521-88-4417", counselor: "P. Okafor", counselorEmail: "pokafor@michigan.gov",
    serviceType: "Job Development", authStart: "2026-06-08", authEnd: "2026-07-08",
    authorizedHours: 24, coach: "Denise Carter", disability: "Learning disability",
    goal: "Dental Administration", status: "Active",
    progressLog: [
      { date: "2026-06-10", type: "Assessment", hours: 3, report: "Completed intake and interest profiler. Service plan drafted with client.", next: "Schedule weekly coaching sessions." },
      { date: "2026-06-18", type: "Job Coaching", hours: 4, report: "Coaching session on workplace communication and daily routines. Documentation updated.", next: "Continue skill-building sessions." },
      { date: "2026-06-27", type: "Job Coaching", hours: 3, report: "Reviewed progress toward service-plan goals with client. All session notes current.", next: "Schedule mid-authorization review." }
    ]
  },
  {
    id: "c2", name: "Lucas Mbeki", authNumber: "MRS-204902",
    ssn: "604-31-7788", counselor: "R. Santini", counselorEmail: "rsantini@michigan.gov",
    serviceType: "Job Coaching", authStart: "2026-05-20", authEnd: "2026-06-20",
    authorizedHours: 20, coach: "Marcus Hill", disability: "Physical mobility",
    goal: "Retail", status: "At risk",
    progressLog: [
      { date: "2026-05-22", type: "Assessment", hours: 2, report: "Intake complete. Transportation and scheduling needs documented.", next: "Build the service plan with client." },
      { date: "2026-06-02", type: "Job Coaching", hours: 3, report: "Coaching session on workplace readiness. Client engaged and on track.", next: "Schedule the next coaching session." }
    ]
  },
  {
    id: "c3", name: "Jason Alvarez", authNumber: "MRS-205110",
    ssn: "489-52-1093", counselor: "P. Okafor", counselorEmail: "pokafor@michigan.gov",
    serviceType: "WBLE", authStart: "2026-06-15", authEnd: "2026-07-30",
    authorizedHours: 40, coach: "Denise Carter", disability: "Autism spectrum",
    goal: "Laundry / Facilities", status: "Active",
    progressLog: [
      { date: "2026-06-17", type: "Assessment", hours: 4, report: "Assessment complete. WBLE service schedule agreed with client and family.", next: "Begin scheduled training sessions." },
      { date: "2026-06-24", type: "WBLE", hours: 6, report: "First training session delivered. Client comfortable with routines. Notes filed.", next: "Continue scheduled training sessions." }
    ]
  },
  {
    id: "c4", name: "Priya Nair", authNumber: "MRS-205188",
    ssn: "330-77-6021", counselor: "T. Blevins", counselorEmail: "tblevins@michigan.gov",
    serviceType: "Job Coaching", authStart: "2026-06-25", authEnd: "2026-08-01",
    authorizedHours: 16, coach: "Angela Reed", disability: "Hearing impairment",
    goal: "Data Entry", status: "New",
    progressLog: []
  },
  {
    id: "c5", name: "Devon Wright", authNumber: "MRS-204650",
    ssn: "712-40-9954", counselor: "R. Santini", counselorEmail: "rsantini@michigan.gov",
    serviceType: "Job Development", authStart: "2026-05-01", authEnd: "2026-06-01",
    authorizedHours: 24, coach: "Marcus Hill", disability: "Anxiety disorder",
    goal: "Warehouse", status: "Complete",
    progressLog: [
      { date: "2026-05-05", type: "Assessment", hours: 3, report: "Intake and service-plan goal setting complete.", next: "Begin weekly sessions." },
      { date: "2026-05-14", type: "Job Coaching", hours: 8, report: "Four coaching sessions delivered this period. Documentation current.", next: "Continue sessions." },
      { date: "2026-05-24", type: "Job Coaching", hours: 8, report: "Service-plan goals met. Client outcomes documented for reporting.", next: "Final review session." },
      { date: "2026-05-30", type: "Job Coaching", hours: 5, report: "All authorized hours delivered. Final documentation complete.", next: "Close out authorization." }
    ]
  }
];

// Users the login screen maps to.
const USERS = {
  Administrator: { name: "Terri Brinston", title: "Administrator" },
  Coach:         { name: "Denise Carter", title: "Coach" },
  Supervisor:    { name: "A. Whitfield", title: "Supervisor" }
};

// Placement activity per client: each application, interview, and employer
// contact is its own logged record. The Job Progression view walks these in
// order, and the counts are DERIVED from them (never typed twice).
CLIENTS.find(c => c.id === "c1").placementLog = [
  { date: "2026-06-19", kind: "Employer Contact", employer: "Bright Lake Dental Group", note: "Called the office manager, introduced Jaymar, confirmed they hire front-desk support." },
  { date: "2026-06-20", kind: "Application", employer: "Bright Lake Dental Group", note: "Applied to Dental Front Office Assistant (Indeed)." },
  { date: "2026-06-20", kind: "Application", employer: "Great Lakes Smile Center", note: "Applied to Patient Scheduling Coordinator (company careers page)." },
  { date: "2026-06-23", kind: "Employer Contact", employer: "Great Lakes Smile Center", note: "Followed up by email on the scheduling application." },
  { date: "2026-06-24", kind: "Interview", employer: "Bright Lake Dental Group", note: "Phone screen scheduled for June 26." },
  { date: "2026-06-26", kind: "Interview", employer: "Bright Lake Dental Group", note: "Phone screen completed. Positive, moving to in-person." },
  { date: "2026-06-27", kind: "Application", employer: "Parkview Dental Associates", note: "Applied to Dental Records Clerk (LinkedIn)." },
  { date: "2026-06-30", kind: "Interview", employer: "Bright Lake Dental Group", note: "In-person interview set for July 3. Prepping this week." }
];
CLIENTS.find(c => c.id === "c2").placementLog = [
  { date: "2026-05-28", kind: "Employer Contact", employer: "Riverside Grocery", note: "Called store manager about entry-level stock roles near transit." },
  { date: "2026-05-30", kind: "Application", employer: "Riverside Grocery", note: "Applied to Retail Associate." },
  { date: "2026-06-02", kind: "Application", employer: "Metro Hardware", note: "Applied to Sales Floor Associate." },
  { date: "2026-06-05", kind: "Interview", employer: "Riverside Grocery", note: "Callback received. Mock interview with coach scheduled first." }
];
CLIENTS.find(c => c.id === "c3").placementLog = [
  { date: "2026-06-17", kind: "Employer Contact", employer: "Community Laundry Co-op", note: "Confirmed WBLE worksite placement and start plan." },
  { date: "2026-06-24", kind: "Employer Contact", employer: "Community Laundry Co-op", note: "Checked in with the site supervisor after the first worksite day." }
];
CLIENTS.find(c => c.id === "c4").placementLog = [];
CLIENTS.find(c => c.id === "c5").placementLog = [
  { date: "2026-05-14", kind: "Application", employer: "Regional Distribution Center", note: "Applied to Warehouse Associate." },
  { date: "2026-05-16", kind: "Application", employer: "Northside Fulfillment", note: "Applied to Order Picker." },
  { date: "2026-05-19", kind: "Interview", employer: "Regional Distribution Center", note: "Interview completed. Strong fit." },
  { date: "2026-05-22", kind: "Employer Contact", employer: "Regional Distribution Center", note: "Offer confirmed. Start date set." }
];

// AI-sourced job leads per client (mock). In the real app these come from a paid
// job-data feed, ranked against the client profile. Here they are seeded to show
// the concept, scored and matched to each client's goal.
// foundDaysAgo: 0 = the system found this lead in THIS morning's run;
// 1+ = found on an earlier run this week (still open, not yet pursued/closed).
CLIENTS.find(c => c.id === "c1").leads = [
  { title: "Dental Front Office Assistant", employer: "Bright Lake Dental Group", source: "Indeed", location: "Southfield, MI", score: 94, foundDaysAgo: 0, why: "Matches dental office interest, scheduling exposure, and front-desk workflow." },
  { title: "Patient Scheduling Coordinator", employer: "Great Lakes Smile Center", source: "Company careers page", location: "Livonia, MI", score: 89, foundDaysAgo: 0, why: "Strong fit for appointment setting, reminder calls, and professional patient communication." },
  { title: "Dental Records Clerk", employer: "Parkview Dental Associates", source: "LinkedIn", location: "Dearborn, MI", score: 84, foundDaysAgo: 2, why: "Entry-level administrative role with records, scanning, insurance forms, and team support." }
];
CLIENTS.find(c => c.id === "c2").leads = [
  { title: "Retail Associate", employer: "Riverside Grocery", source: "Indeed", location: "Detroit, MI (near transit)", score: 88, foundDaysAgo: 0, why: "Entry-level retail near transit with flexible shifts and on-the-job training." },
  { title: "Sales Floor Associate", employer: "Metro Hardware", source: "Company careers page", location: "Warren, MI", score: 82, foundDaysAgo: 1, why: "Customer-facing floor role with structured tasks and steady hours." }
];
CLIENTS.find(c => c.id === "c3").leads = [
  { title: "Laundry Attendant", employer: "Community Laundry Co-op", source: "State job board", location: "Detroit, MI", score: 90, foundDaysAgo: 0, why: "Structured, routine-based facilities role matching the WBLE placement plan." },
  { title: "Facilities Support Aide", employer: "Riverside Community Center", source: "Indeed", location: "Dearborn, MI", score: 80, foundDaysAgo: 3, why: "Predictable environment, clear repeatable tasks, and a supportive team." }
];
CLIENTS.find(c => c.id === "c4").leads = [
  { title: "Data Entry Clerk", employer: "Northbrook Insurance", source: "Company careers page", location: "Troy, MI", score: 86, foundDaysAgo: 0, why: "Quiet, focused data role with written workflows that suit her accommodation needs." }
];
CLIENTS.find(c => c.id === "c5").leads = [];

let AUDIT = []; // populated at runtime
