import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const CUSD_SEPOLIA = "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1";
const CUSD_MAINNET   = "0x765DE816845861e75A25fCA122bb6898B8B1282a";

const CeloDuelsModule = buildModule("CeloDuelsModule", (m) => {
  const cUSD         = m.getParameter("cUSD", CUSD_SEPOLIA);
  const feeRecipient = m.getParameter("feeRecipient", "0xCd4dC296efF185d97D11D7b90472e230D65516a1");

  const celoDuels = m.contract("CeloDuels", [cUSD, feeRecipient]);

  return { celoDuels };
});

export default CeloDuelsModule;