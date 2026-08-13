export const vercelService = {
  /**
   * Trigger a build on Vercel via a deploy hook URL
   */
  async triggerDeploy(hookUrl: string): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const response = await fetch(hookUrl, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error(`Vercel hook responded with status ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        id: data.job?.id || data.id || 'vercel-deploy-job'
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || String(err)
      };
    }
  }
};
