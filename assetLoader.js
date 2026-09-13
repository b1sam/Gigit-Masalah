/* ==========================================================
   Asset Loader – reserved for future custom model support
   Not used by the main game loop; safe to import
   ========================================================== */
export const assetLoader = {
  configure() {},
  async loadAllAssets() { return { player: null, rod: null, bobber: null }; }
};
