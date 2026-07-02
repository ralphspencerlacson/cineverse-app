import networks from "../../service/networks";
import "./Networks.css";

const Networks = ({ currentNetwork, setNetwork }) => {
  return (
    <section className="network-picker" aria-label="Streaming networks">
      <div className="network-picker__header">
        <div>
          <p className="network-picker__eyebrow">Networks</p>
          <h2>Choose a Streaming Hub</h2>
        </div>
        <span className="network-picker__current">{currentNetwork}</span>
      </div>

      <div className="network-picker__rail">
        {Object.keys(networks).map((network) => (
          <button
            type="button"
            key={network}
            className={`network-picker__chip ${network === currentNetwork ? "active" : ""}`}
            onClick={() => setNetwork(network)}
          >
            {network}
          </button>
        ))}
      </div>
    </section>
  );
};

export default Networks;
