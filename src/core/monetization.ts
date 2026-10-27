import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPosition,
  BannerAdSize,
  MaxAdContentRating,
} from '@capacitor-community/admob';
import { BillingPlugin } from 'capacitor-billing';

export const REMOVE_ADS_PRODUCT = 'remove_ads';

// Use the registered Tidewake unit for release builds; VITE_ADMOB_BANNER_ID can override it for QA.
export const ADMOB_APP_ID = 'ca-app-pub-6279186647593327~3110225470';
export const ADMOB_BANNER_ID = 'ca-app-pub-6279186647593327/7122542541';
const TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';
const isTesting = import.meta.env.VITE_ADMOB_TEST === '1' || (!import.meta.env.VITE_ADMOB_BANNER_ID && import.meta.env.MODE !== 'production');
const bannerId = import.meta.env.VITE_ADMOB_BANNER_ID || (isTesting ? TEST_BANNER_ID : ADMOB_BANNER_ID);
const ENTITLEMENT_KEY = 'tidewake.removeAds';

/** Native monetization with a quiet no-op on web builds. */
export class Monetization {
  readonly native = Capacitor.isNativePlatform();
  private initialized = false;

  hasRemovedAds(): boolean {
    try {
      return localStorage.getItem(ENTITLEMENT_KEY) === '1';
    } catch {
      return false;
    }
  }

  async init(): Promise<void> {
    if (!this.native || this.hasRemovedAds()) return;
    try {
      let consent = await AdMob.requestConsentInfo();
      if (consent.isConsentFormAvailable && consent.status === AdmobConsentStatus.REQUIRED) {
        consent = await AdMob.showConsentForm();
      }
      if (!consent.canRequestAds) return;
      await AdMob.initialize({
        initializeForTesting: isTesting,
        maxAdContentRating: MaxAdContentRating.Teen,
      });
      this.initialized = true;
    } catch (err) {
      console.warn('[monetization] AdMob initialization failed', err);
    }
  }

  async showBanner(): Promise<void> {
    if (!this.native || !this.initialized || this.hasRemovedAds()) return;
    try {
      await AdMob.showBanner({
        adId: bannerId,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        isTesting,
      });
    } catch (err) {
      console.warn('[monetization] banner failed', err);
    }
  }

  async hideBanner(): Promise<void> {
    if (!this.native || !this.initialized) return;
    try {
      await AdMob.hideBanner();
    } catch (err) {
      console.warn('[monetization] banner hide failed', err);
    }
  }

  async purchaseRemoveAds(): Promise<boolean> {
    if (!this.native || this.hasRemovedAds()) return this.hasRemovedAds();
    try {
      const result = await BillingPlugin.launchBillingFlow({ product: REMOVE_ADS_PRODUCT, type: 'INAPP' });
      const purchaseToken = (result as unknown as { purchaseToken?: string }).purchaseToken;
      if (purchaseToken) await BillingPlugin.sendAck({ purchaseToken });
      try {
        localStorage.setItem(ENTITLEMENT_KEY, '1');
      } catch {
        /* The purchase is still acknowledged; a later launch can restore through Play Billing. */
      }
      await this.hideBanner();
      return true;
    } catch (err) {
      console.warn('[monetization] purchase cancelled/failed', err);
      return false;
    }
  }
}
