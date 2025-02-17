import React from "react";

function IframePage() {
  return (
    <div style={{ width: "", height: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
      <iframe
        src="https://flooz.xyz/embed/trade?swapDisabled=false&swapNetwork=eth&swapToTokenAddress=eth&swapLockToToken=false&onRampDisabled=false&onRampNetwork=eth&onRampAsDefault=true&onRampTokenAddress=eth&network=eth&lightMode=false&backgroundColor=transparent&miniApp=false&miniappIntent=swap"
        title="Embedded Page"
        width="100%"
        height="750px"
        style={{ border: "none" }}
      ></iframe>
    </div>
  );
}

export default IframePage;
