import { NextResponse } from 'next/server';
import { HarmosScraper } from '@/utils/harmosScraper';
import path from 'path';

export async function POST() {
  try {
    console.log('求人詳細のスクレイピングを開始します...');
    
    // 環境変数の確認
    const email = process.env.HRMOS_EMAIL;
    const password = process.env.HRMOS_PASSWORD;
    
    if (!email || !password) {
      console.error('ログイン情報が設定されていません');
      return NextResponse.json({
        success: false,
        message: 'ログイン情報が設定されていません。環境変数 HRMOS_EMAIL と HRMOS_PASSWORD を設定してください。'
      }, { status: 500 });
    }
    
    // スクレイパーのインスタンスを作成
    const scraper = new HarmosScraper();
    
    try {
      // スクレイパーを初期化
      console.log('ブラウザを初期化しています...');
      await scraper.initialize();
      
      // ログイン
      console.log('ログインを実行しています...');
      await scraper.login();
      
      // 全ての求人詳細をスクレイピング
      console.log('全ての求人詳細をスクレイピングしています...');
      const jobDetails = await scraper.scrapeAllJobDetails();
      
      if (jobDetails.length === 0) {
        throw new Error('求人詳細の取得に失敗しました');
      }
      
      // CSVファイルに出力
      console.log('CSVファイルに出力しています...');
      const outputPath = path.join(process.cwd(), 'public', 'job-details.csv');
      await scraper.exportJobDetailsToCSV(jobDetails, outputPath);
      
      // スクレイパーを閉じる
      console.log('ブラウザを閉じています...');
      await scraper.close();
      
      console.log('求人詳細のスクレイピングが完了しました');
      
      return NextResponse.json({
        success: true,
        message: `${jobDetails.length}件の求人詳細のスクレイピングが完了しました`,
        data: jobDetails
      });
    } catch (scraperError) {
      console.error('スクレイパー処理中にエラーが発生しました:', scraperError);
      
      // スクレイパーを閉じる
      try {
        await scraper.close();
      } catch (closeError) {
        console.error('ブラウザを閉じる際にエラーが発生しました:', closeError);
      }
      
      return NextResponse.json({
        success: false,
        message: 'スクレイピング中にエラーが発生しました',
        error: scraperError instanceof Error ? scraperError.message : '不明なエラー',
        stack: scraperError instanceof Error ? scraperError.stack : undefined
      }, { status: 500 });
    }
  } catch (error) {
    console.error('求人詳細のスクレイピング中にエラーが発生しました:', error);
    
    return NextResponse.json({
      success: false,
      message: '求人詳細のスクレイピング中にエラーが発生しました',
      error: error instanceof Error ? error.message : '不明なエラー',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
} 