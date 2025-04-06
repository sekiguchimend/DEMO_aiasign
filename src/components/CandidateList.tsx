import { CandidateInfo } from '@/types/harmos';

interface CandidateListProps {
  candidates: CandidateInfo[];
  isLoading: boolean;
}

export default function CandidateList({ candidates, isLoading }: CandidateListProps) {
  return (
    <div className="bg-white border border-blue-100 rounded-lg p-6 shadow-md">
      <h2 className="text-2xl font-semibold mb-4 text-blue-900">取得した候補者情報</h2>
      
      {candidates.length > 0 ? (
        <div className="space-y-4">
          {candidates.map((candidate, index) => (
            <div key={index} className="bg-gray-50 p-4 rounded-md border border-gray-200">
              <h3 className="text-xl font-medium mb-2 text-blue-900">{candidate.name}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="font-medium text-gray-700">職種分類:</span> {candidate.jobCategory}
                </div>
                <div>
                  <span className="font-medium text-gray-700">最終更新日:</span> {candidate.lastUpdated}
                </div>
                <div className="md:col-span-2">
                  <span className="font-medium text-gray-700">URL:</span>{' '}
                  <a
                    href={candidate.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 hover:underline break-all"
                  >
                    {candidate.url}
                  </a>
                </div>
                <div className="md:col-span-2">
                  <span className="font-medium text-gray-700">業務内容:</span>
                  <div className="mt-1 p-2 bg-white rounded border border-gray-200 text-gray-800 whitespace-pre-line">
                    {candidate.jobDescription}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <span className="font-medium text-gray-700">応募要件:</span>
                  <div className="mt-1 p-2 bg-white rounded border border-gray-200 text-gray-800 whitespace-pre-line">
                    {candidate.requirements}
                  </div>
                </div>
                <div>
                  <span className="font-medium text-gray-700">企業ID:</span> {candidate.companyId}
                </div>
                <div>
                  <span className="font-medium text-gray-700">求人ID:</span> {candidate.jobId}
                </div>
                <div>
                  <span className="font-medium text-gray-700">候補者ID:</span> {candidate.candidateId}
                </div>
                <div>
                  <span className="font-medium text-gray-700">候補者詳細ID:</span> {candidate.candidateDetailId}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          {isLoading ? (
            <p>候補者情報を取得中です...</p>
          ) : (
            <p>候補者情報がありません。上記のボタンをクリックして取得してください。</p>
          )}
        </div>
      )}
    </div>
  );
} 