import { runNewsFeedScan } from "./newsFeedScanner";
import { runDealHunterScan } from "./dealHunter";


export async function runAllRealScans() {
  const results = {
    news: null as any,
    jobs: null as any,
    predictive: null as any,
    errors: [] as string[],
  };

  try {
    results.news = await runNewsFeedScan();
  } catch (err: any) {
    results.errors.push(`news: ${err?.message ?? String(err)}`);
  }

  try {
    results.jobs = await runDealHunterScan();
  } catch (err: any) {
    results.errors.push(`jobs: ${err?.message ?? String(err)}`);
  }

  try {
    results.predictive = null;
  } catch (err: any) {
    results.errors.push(`predictive: ${err?.message ?? String(err)}`);
  }

  return {
    success: results.errors.length === 0,
    ...results,
  };
}