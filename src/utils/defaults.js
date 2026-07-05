/** Default bilingual terms text for the handover form (Zimmet Tutanağı).
 *  Editable per-instance via Settings; paragraphs are separated by blank lines. */
const DEFAULT_HANDOVER_TERMS = `I acknowledge receipt of the equipment listed above in good working condition. I understand that this equipment is the property of the company and is provided to me solely for business use. I agree to take reasonable care of these assets, follow all corporate security policies, and return them immediately upon request or termination of employment. In the event of loss, theft, or damage due to negligence, I may be held responsible for the replacement or repair costs.

Yukarıda listelenen ekipmanları çalışır durumda teslim aldığımı kabul ediyorum. Bu ekipmanların şirketin mülkiyetinde olduğunu ve tarafıma sadece iş amaçlı kullanım için tahsis edildiğini anlıyorum. Bu varlıklara makul özeni göstermeyi, tüm kurumsal güvenlik politikalarına uymayı ve talep edildiğinde veya iş akdimin feshinde derhal iade etmeyi kabul ediyorum. İhmal sonucu oluşabilecek kayıp, çalıntı veya hasar durumlarında onarım veya yenileme maliyetlerinden sorumlu tutulabileceğimi beyan ederim.`;

/** Default lifecycle duration (months) per product category — centrally
 *  managed in Settings and applied to every asset of that category. */
const DEFAULT_LIFECYCLES = {
  Laptop: 48, Desktop: 60, Monitor: 72, Phone: 36, Tablet: 36,
  Printer: 60, Network: 84, Peripheral: 36, Other: 48,
};

module.exports = { DEFAULT_HANDOVER_TERMS, DEFAULT_LIFECYCLES };
