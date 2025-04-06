import puppeteer, { Browser, Page, ElementHandle } from 'puppeteer';
import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';

interface JobListing {
  title: string;
  url: string;
  status: 'OPEN' | 'CLOSE';
  lastUpdated: string;
  companyId?: string;
  jobId?: string;
}

export class HarmosScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize() {
    console.log('🚀 ブラウザを初期化しています...');
    try {
      this.browser = await puppeteer.launch({
        headless: true,
      });
      this.page = await this.browser.newPage();
      console.log('✅ ブラウザの初期化が完了しました');
    } catch (error) {
      console.error('❌ ブラウザの初期化中にエラーが発生しました:', error);
      throw error;
    }
  }

  async login() {
    if (!this.page) throw new Error('Browser not initialized');

    const email = process.env.HRMOS_EMAIL;
    const password = process.env.HRMOS_PASSWORD;

    if (!email || !password) {
      console.error('❌ ログイン情報が設定されていません');
      throw new Error('HRMOS login credentials are not set in environment variables');
    }

    console.log('🔑 ログイン処理を開始します...');
    console.log(`📝 アクセス先: https://hrmos.co/agent/corporates`);

    try {
      // 直接企業一覧ページにアクセス
      await this.page.goto('https://hrmos.co/agent/corporates');
      console.log(`📍 現在のURL: ${this.page.url()}`);

      // ログインページにリダイレクトされた場合の処理
      const currentUrl = this.page.url();
      if (currentUrl.includes('/login')) {
        console.log('🔒 ログインページにリダイレクトされました。ログインを実行します...');
        await this.page.type('input[name="email"]', email);
        await this.page.type('input[name="password"]', password);
        await this.page.click('button[type="submit"]');
        await this.page.waitForNavigation();
        console.log(`📍 ログイン後のURL: ${this.page.url()}`);
        console.log('✅ ログインが完了しました');
      } else {
        console.log('✅ すでにログイン済みです');
      }
    } catch (error) {
      console.error('❌ ログイン処理中にエラーが発生しました:', error);
      throw error;
    }
  }

  async scrapeJobListings(): Promise<JobListing[]> {
    if (!this.page) throw new Error('Browser not initialized');

    console.log('🔍 求人情報のスクレイピングを開始します...');
    const jobListings: JobListing[] = [];
    
    try {
      // 企業一覧ページにアクセス
      const url = 'https://hrmos.co/agent/corporates';
      
      console.log(`📝 アクセス先: ${url}`);
      await this.page.goto(url);
      console.log(`📍 現在のURL: ${this.page.url()}`);

      // 求人一覧ページの要素を待機
      console.log('⏳ 求人一覧の要素を待機中...');
      try {
        // Angularのコンポーネント構造に対応するセレクタを試す
        const selectors = [
          '.ng-star-inserted',
          '[class*="ng-tns-c"]',
          '[class*="ng-star-inserted"]',
          '.job-listing',
          '.job-card',
          '.job-item',
          '.job',
          'article',
          '.list-item',
          'a[href*="/jobs/"]'
        ];
        
        let foundSelector = '';
        for (const selector of selectors) {
          console.log(`🔍 セレクタ "${selector}" を試しています...`);
          try {
            await this.page.waitForSelector(selector, { timeout: 5000 });
            foundSelector = selector;
            console.log(`✅ セレクタ "${selector}" が見つかりました`);
            break;
          } catch (error) {
            console.log(`⚠️ セレクタ "${selector}" が見つかりませんでした`);
          }
        }
        
        if (!foundSelector) {
          console.warn('⚠️ 求人一覧の要素が見つかりませんでした。ページの構造が変更された可能性があります。');
          console.log('🔍 ページのHTMLを確認します...');
          const pageContent = await this.page.content();
          console.log(`📄 ページのHTML: ${pageContent.substring(0, 500)}...`);
          return [];
        }
      } catch (error) {
        console.warn('⚠️ 求人一覧の要素が見つかりませんでした。ページの構造が変更された可能性があります。');
        console.log('🔍 ページのHTMLを確認します...');
        const pageContent = await this.page.content();
        console.log(`📄 ページのHTML: ${pageContent.substring(0, 500)}...`);
        return [];
      }

      // 求人リンクを取得 - Angularのコンポーネント構造に対応
      console.log('🔍 求人リンクを検索中...');
      
      // まず、ng-star-insertedクラスを持つ要素を取得
      const ngStarElements = await this.page.$$('.ng-star-inserted');
      console.log(`📊 ng-star-inserted要素数: ${ngStarElements.length}件`);
      
      // 次に、ng-tns-cで始まるクラスを持つ要素を取得
      const ngTnsElements = await this.page.$$('[class*="ng-tns-c"]');
      console.log(`📊 ng-tns-c要素数: ${ngTnsElements.length}件`);
      
      // 求人リンクを取得
      const jobLinks = await this.page.$$('a[href*="/jobs/"]');
      console.log(`📊 求人リンク数: ${jobLinks.length}件`);
      
      // すべての要素を結合
      const allElements = [...ngStarElements, ...ngTnsElements, ...jobLinks];
      console.log(`📊 合計要素数: ${allElements.length}件`);
      
      if (allElements.length === 0) {
        console.warn('⚠️ 求人要素が見つかりませんでした。');
        return [];
      }
      
      // 各要素から情報を取得
      for (let i = 0; i < allElements.length; i++) {
        const element = allElements[i];
        try {
          console.log(`\n🔍 要素 ${i+1}/${allElements.length} の情報を取得中...`);
          
          // 要素のHTMLを取得して確認
          const elementHtml = await element.evaluate((el: Element) => el.outerHTML);
          console.log(`🔍 要素のHTML: ${elementHtml.substring(0, 100)}...`);
          
          // URLを取得
          let url = '';
          try {
            // 要素自体がリンクか、子要素にリンクがあるかを確認
            if (elementHtml.includes('href="/jobs/')) {
              url = await element.evaluate((el: Element) => {
                if (el instanceof HTMLAnchorElement) {
                  return el.href;
                } else {
                  const link = el.querySelector('a[href*="/jobs/"]');
                  return link ? (link as HTMLAnchorElement).href : '';
                }
              });
              console.log(`🔗 URL: ${url}`);
            } else {
              console.log('⚠️ この要素には求人リンクが含まれていません');
              continue; // 次の要素へ
            }
          } catch (error) {
            console.warn(`⚠️ URLの取得に失敗しました: ${error}`);
            continue; // 次の要素へ
          }
          
          // URLから企業IDと求人IDを抽出
          let companyId = '';
          let jobId = '';
          try {
            const urlParts = url.split('/');
            const jobsIndex = urlParts.indexOf('jobs');
            if (jobsIndex !== -1 && jobsIndex > 0) {
              companyId = urlParts[jobsIndex - 1];
              if (jobsIndex + 1 < urlParts.length) {
                jobId = urlParts[jobsIndex + 1];
              }
            }
            console.log(`🏢 企業ID: ${companyId}, 求人ID: ${jobId}`);
          } catch (error) {
            console.warn(`⚠️ IDの抽出に失敗しました: ${error}`);
          }
          
          // タイトルを取得
          let title = '';
          try {
            title = await element.evaluate((el: Element) => {
              // 要素自体がリンクの場合
              if (el instanceof HTMLAnchorElement) {
                return el.textContent || '';
              } 
              // 子要素にリンクがある場合
              const link = el.querySelector('a[href*="/jobs/"]');
              if (link) {
                return link.textContent || '';
              }
              // それ以外の場合は要素のテキストを返す
              return el.textContent || '';
            });
            console.log(`📌 タイトル: ${title.trim()}`);
          } catch (error) {
            console.warn(`⚠️ タイトルの取得に失敗しました: ${error}`);
            title = 'タイトル不明';
          }
          
          // ステータスを取得
          let status = 'UNKNOWN';
          try {
            // 要素のテキストからステータスを判断
            const elementText = await element.evaluate((el: Element) => el.textContent || '');
            status = elementText.includes('募集中') ? 'OPEN' : 'CLOSE';
            console.log(`📊 ステータス: ${status}`);
          } catch (error) {
            console.warn(`⚠️ ステータスの取得に失敗しました: ${error}`);
          }
          
          // 最終更新日を取得
          let lastUpdated = '';
          try {
            // 要素内の日付を探す
            const dateText = await element.evaluate((el: Element) => {
              // 日付っぽいテキストを探す
              const text = el.textContent || '';
              const dateMatch = text.match(/\d{4}\/\d{1,2}\/\d{1,2}|\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2}|\d{1,2}月\d{1,2}日/);
              return dateMatch ? dateMatch[0] : '';
            });
            
            if (dateText) {
              lastUpdated = dateText.trim();
              console.log(`🕒 最終更新日: ${lastUpdated}`);
            } else {
              lastUpdated = '更新日不明';
            }
          } catch (error) {
            console.warn(`⚠️ 最終更新日の取得に失敗しました: ${error}`);
            lastUpdated = '更新日不明';
          }

          // 重複チェック - 同じURLの求人が既に追加されているか確認
          const isDuplicate = jobListings.some(job => job.url === url);
          if (isDuplicate) {
            console.log('⚠️ この求人は既に追加されています。スキップします。');
            continue;
          }

          jobListings.push({
            title: title.trim(),
            url,
            status: status as 'OPEN' | 'CLOSE',
            lastUpdated: lastUpdated.trim(),
            companyId,
            jobId
          });
          console.log('✅ 求人情報の取得が完了しました');
        } catch (error) {
          console.error(`❌ 要素 ${i+1}/${allElements.length} の情報取得中にエラーが発生しました:`, error);
          // エラーが発生しても処理を継続
          continue;
        }
      }
    } catch (error) {
      console.error('❌ スクレイピング中にエラーが発生しました:', error);
      // エラーが発生しても空の配列を返す
      return [];
    }

    console.log(`\n📊 合計 ${jobListings.length} 件の求人情報を取得しました`);
    return jobListings;
  }

  async exportToCSV(jobListings: JobListing[], outputPath: string) {
    console.log(`\n💾 CSVファイルに出力しています...`);
    console.log(`📁 出力先: ${outputPath}`);
    
    try {
      const csvWriter = createObjectCsvWriter({
        path: outputPath,
        header: [
          { id: 'title', title: '求人タイトル' },
          { id: 'url', title: 'URL' },
          { id: 'status', title: 'ステータス' },
          { id: 'lastUpdated', title: '最終更新日' },
          { id: 'companyId', title: '企業ID' },
          { id: 'jobId', title: '求人ID' },
        ],
      });

      await csvWriter.writeRecords(jobListings);
      console.log('✅ CSVファイルの出力が完了しました');
    } catch (error) {
      console.error('❌ CSVファイルの出力中にエラーが発生しました:', error);
      throw error;
    }
  }

  async close() {
    if (this.browser) {
      console.log('🔒 ブラウザを終了しています...');
      try {
        await this.browser.close();
        console.log('✅ ブラウザを終了しました');
      } catch (error) {
        console.error('❌ ブラウザの終了中にエラーが発生しました:', error);
      }
    }
  }
} 