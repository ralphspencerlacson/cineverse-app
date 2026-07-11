import networks from "../../service/networks";
import { useFetchApi } from "../../hooks/useFetchApi";
import { getNetworkDetails } from "../../service/tmdb/requests";
import "./Networks.css";

const TMDB_ASSET_BASEURL = import.meta.env.VITE_TMDB_ASSET_BASEURL;

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
        {Object.entries(networks).map(([network, id]) => (
          <NetworkButton
            key={network}
            id={id}
            name={network}
            isActive={network === currentNetwork}
            onSelect={setNetwork}
          />
        ))}
      </div>
    </section>
  );
};

const NetworkButton = ({ id, name, isActive, onSelect }) => {
  const { apiData: networkDetails } = useFetchApi(getNetworkDetails(id), "tmdb");
  const logoUrl = networkDetails?.logo_path
    ? `${TMDB_ASSET_BASEURL}${networkDetails.logo_path}`
    : null;

  return (
    <button
      type="button"
      className={`network-picker__chip ${isActive ? "active" : ""}`}
      onClick={() => onSelect(name)}
    >
      <span className="network-picker__logo-wrap">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="network-picker__logo" />
        ) : (
          <span className="network-picker__fallback-logo">{name.slice(0, 2)}</span>
        )}
      </span>
      <span className="network-picker__name">{name}</span>
    </button>
  );
};

export default Networks;
