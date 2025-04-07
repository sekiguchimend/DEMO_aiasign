export interface CandidateInfo {
  name: string;
  url: string;
  jobCategory: string;
  jobDescription: string;
  requirements: string;
  lastUpdated: string;
  companyId: string;
  jobId: string;
  candidateId: string;
  candidateDetailId: string;
}

export interface JobDetail {
  title: string;
  description: string;
  requirements: string;
  workLocation: string;
  employmentType: string;
  salary: string;
  workingHours: string;
  holidays: string;
  benefits: string;
  lastUpdated: string;
} 