// ShelbyUSD fungible asset constants (Shelbynet)
export const SHELBYUSD_METADATA =
  "0x1b18363a9f1fe5e6ebf247daba5cc1c18052bb232efdc4c50f556053922d98e1";

export const OCTAS_PER_USD = 1e8;

/**
 * Build an Aptos entry-function payload to transfer ShelbyUSD
 * via primary_fungible_store::transfer.
 *
 * Works with @aptos-labs/wallet-adapter-react's signAndSubmitTransaction.
 */
export function buildShelbyUSDTransfer(recipient: string, amountOctas: number) {
  return {
    data: {
      function:
        "0x1::primary_fungible_store::transfer" as `${string}::${string}::${string}`,
      typeArguments: ["0x1::fungible_asset::Metadata"],
      functionArguments: [SHELBYUSD_METADATA, recipient, amountOctas],
    },
  };
}
