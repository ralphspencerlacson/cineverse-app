import networks from "../../service/networks";
import { useFetchApi } from "../../hooks/useFetchApi";
import { getNetworkDetails } from "../../service/tmdb/requests";
import "./Networks.css";

const TMDB_ASSET_BASEURL = import.meta.env.VITE_TMDB_ASSET_BASEURL;

const Networks = ({ currentNetwork, setNetwork }) => {
  const networkEntries = Object.entries(networks);
  const currentIndex = networkEntries.findIndex(([network]) => network === currentNetwork);

  return (
    <section className="network-picker" aria-label="Streaming networks">
      <div className="network-picker__header">
        <div>
          <p className="network-picker__eyebrow">Networks</p>
          <h2>Choose a Streaming Hub</h2>
          <p className="network-picker__lede">Tune the catalog to one streaming signal.</p>
        </div>
        <div className="network-picker__current" aria-live="polite">
          <span><i aria-hidden="true" /> Now tuned</span>
          <strong>{currentNetwork}</strong>
          <small>Channel {String(currentIndex + 1).padStart(2, "0")} / {String(networkEntries.length).padStart(2, "0")}</small>
        </div>
      </div>

      <div className="network-picker__rail">
        {networkEntries.map(([network, id], index) => (
          <NetworkButton
            key={network}
            id={id}
            index={index}
            name={network}
            isActive={network === currentNetwork}
            onSelect={setNetwork}
          />
        ))}
      </div>
    </section>
  );
};

const NetworkButton = ({ id, index, name, isActive, onSelect }) => {
  const { apiData: networkDetails } = useFetchApi(getNetworkDetails(id), "tmdb");
  const logoUrl = networkDetails?.logo_path
    ? `${TMDB_ASSET_BASEURL}${networkDetails.logo_path}`
    : null;

  return (
    <button
      type="button"
      className={`network-picker__chip ${isActive ? "active" : ""}`}
      data-network={name}
      onClick={() => onSelect(name)}
      aria-pressed={isActive}
    >
      <span className="network-picker__index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
      <span className="network-picker__logo-wrap">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="network-picker__logo" />
        ) : (
          <span className="network-picker__fallback-logo">{name.slice(0, 2)}</span>
        )}
      </span>
      <span className="network-picker__name">{name}</span>
      <span className="network-picker__signal" aria-hidden="true"><i /><i /><i /></span>
    </button>
  );
};

export default Networks;
