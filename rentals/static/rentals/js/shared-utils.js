// shared-utils.js — Shared utilities across rental management JS modules
(function(){
  'use strict';

  // Helper to escape HTML special characters
  function escapeHtml(s){
    return String(s||'').replace(/[&<>"]/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;'
    }[c]));
  }

  // Export to window for use in other modules
  window.RentalsSharedUtils = {
    escapeHtml: escapeHtml
  };
})();
