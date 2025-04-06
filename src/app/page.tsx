"use client"
import { useState } from 'react';
import { CandidateInfo } from '@/types/harmos';
import CandidateList from '@/components/CandidateList';

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [candidateInfos, setCandidateInfos] = useState<CandidateInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [csvUrl, setCsvUrl] = useState<string | null>(null);

  const handleScrapeCandidates = async () => {
    setIsLoading(true);
    setError(null);
    setMessage(null);
    setCsvUrl(null);
    
    try {
      const response = await fetch('/api/scrape-candidates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCandidateInfos(data.data || []);
        setMessage(data.message);
        setCsvUrl('/candidate-info.csv');
      } else {
        setError(data.message || 'エラーが発生しました');
        setCandidateInfos([]);
      }
    } catch (err) {
      setError('スクレイピング中にエラーが発生しました');
      setCandidateInfos([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white text-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center text-blue-900">HRMOS候補者情報スクレイパー</h1>
        
        <div className="bg-white border border-blue-100 rounded-lg p-6 mb-8 shadow-md">
          <div className="flex justify-center mb-6">
            <button
              onClick={handleScrapeCandidates}
              disabled={isLoading}
              className={`px-6 py-3 rounded-md font-medium text-lg transition-all ${
                isLoading
                  ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                  : 'bg-blue-900 hover:bg-blue-800 text-white'
              }`}
            >
              {isLoading ? 'スクレイピング中...' : '候補者情報を取得'}
            </button>
          </div>
          
          {message && (
            <div className="text-center mb-4 p-3 bg-green-50 text-green-800 rounded-md border border-green-100">
              {message}
            </div>
          )}
          
          {error && (
            <div className="text-center mb-4 p-3 bg-red-50 text-red-800 rounded-md border border-red-100">
              {error}
            </div>
          )}
          
          {csvUrl && (
            <div className="text-center">
              <a
                href={csvUrl}
                download
                className="inline-block px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-md transition-colors"
              >
                CSVファイルをダウンロード
              </a>
            </div>
          )}
        </div>
        
        <CandidateList candidates={candidateInfos} isLoading={isLoading} />
      </div>
    </main>
  );
} 