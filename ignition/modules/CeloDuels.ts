import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const CeloDuelsModule = buildModule("CeloDuelsModule", (m) => {
  const feeRecipient = m.getParameter("feeRecipient", "0xCd4dC296efF185d97D11D7b90472e230D65516a1");

  const celoDuels = m.contract("CeloDuelsMulti", [feeRecipient]);

  return { celoDuels };
});

export default CeloDuelsModule;