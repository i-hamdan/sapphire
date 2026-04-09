import React, { useState } from 'react'
import InteractiveMap3D from './components/InteractiveMap3D'
import plotDetails from './assets/plot_details.json'
import './App.css'
import heroVideo from './assets/hero-bg.mp4'
import logo from './assets/logos/transparent_logo.png'
import { getWhatsAppLink, getCallLink } from './config'

// Amenities Icons
import iconSecurity from './assets/amenities/247 security.png'
import iconBoundary from './assets/amenities/demarcated plots and boundary wall.png'
import iconPayments from './assets/amenities/easy payment plans.png'
import iconGated from './assets/amenities/gated entry and security cabin.png'
import iconROI from './assets/amenities/high investment returns.png'
import iconGazebos from './assets/amenities/seating gazebos and benches.png'
import iconLamps from './assets/amenities/street side lamps.png'
import iconAvenues from './assets/amenities/tree lines avenues.png'
import iconPhone from './assets/telephone.png'

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72 0.94 3.659 1.436 5.632 1.437h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const AMENITIES_DATA = [
  { title: 'Gated Entry & Security Cabin', icon: iconGated },
  { title: '24x7 Security', icon: iconSecurity },
  { title: 'Seating Gazebos & Benches', icon: iconGazebos },
  { title: 'Street Side Light Lamps', icon: iconLamps },
  { title: 'Demarcated Plots & Boundary Wall', icon: iconBoundary },
  { title: '30-25 Ft Wide Tree-Lined Avenues', icon: iconAvenues },
  { title: 'High Investment Returns', icon: iconROI },
  { title: 'Easy Payment Plans', icon: iconPayments },
];

function PlotTable() {
  const [searchTerm, setSearchTerm] = useState('');
  
  const sortedPlots = Object.keys(plotDetails).sort((a, b) => parseInt(a) - parseInt(b));
  const filteredPlots = sortedPlots.filter(pid => pid.includes(searchTerm));

  return (
    <section className="plot-table-section">
      <div className="section-header">
        <div className="header-left">
          <h2>Plot Availability</h2>
          <p>Real-time status of all plots and their respective sizes</p>
        </div>
        <div className="search-container">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input 
            type="text" 
            placeholder="Search Plot No..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Plot</th>
              <th>Area</th>
              <th>Size</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredPlots.map((pid) => {
              const details = plotDetails[pid];
              return (
                <tr key={pid} className={details.isSold ? 'row-sold' : 'row-available'}>
                  <td>
                    <div className="plot-id-cell">
                      <span className="plot-circle"></span>
                      Farm {pid}
                    </div>
                  </td>
                  <td>{details.area_sqft.toLocaleString()}</td>
                  <td>{details.length_ft}' x {details.breadth_ft}'</td>
                  <td>
                    {!details.isSold && (
                      <a 
                        href={getWhatsAppLink(`I'm interested in Farm ${pid}`)}
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="chat-btn"
                        aria-label="Contact on WhatsApp"
                      >
                        <WhatsAppIcon />
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredPlots.length === 0 && (
          <div className="no-results">No plots found matching "{searchTerm}"</div>
        )}
      </div>
    </section>
  );
}

function App() {
  return (
    <div className="app-container">
      <header className="hero">
        <video 
          autoPlay 
          muted 
          loop 
          playsInline 
          className="hero-video"
        >
          <source src={heroVideo} type="video/mp4" />
        </video>
        <div className="hero-overlay"></div>
        <div className="hero-content">
          <img src={logo} alt="Sapphire Logo" className="hero-logo" />
          <h1>Experience <br /> <span className="highlight">Luxury</span> Living</h1>
          <p>Discover your dream farmhouse at Sapphire – where nature meets elegance.</p>
          <div 
            className="scroll-hint" 
            onClick={() => document.getElementById('map').scrollIntoView({ behavior: 'smooth' })}
          >
            <span>Explore Map</span>
            <div className="arrow"></div>
          </div>
        </div>
      </header>

      <main>
        <section className="map-section" id="map">
          <InteractiveMap3D />
        </section>

        <PlotTable />

        <section className="amenities-section">
          <h2>Premium Amenities</h2>
          <div className="amenities-grid">
            {AMENITIES_DATA.map((item, i) => (
              <div key={i} className="amenity-card">
                <div className="amenity-icon">
                  <img src={item.icon} alt={item.title} />
                </div>
                <h3>{item.title}</h3>
              </div>
            ))}
          </div>
        </section>

        <section className="contact-cta-section">
          <div className="cta-inner">
            <h2 className="cta-title">Build Your Legacy at <br /> Sapphire Farms</h2>
            <p className="cta-desc">
              Ready to explore our luxury farmhouses? Our team is here to help you 
              find your perfect plot and start your journey today.
            </p>
            <div className="cta-actions">
              <a 
                href={getWhatsAppLink("I'm interested in Sapphire Farms. Can I get more details?")} 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn-cta btn-whatsapp-cta"
              >
                <WhatsAppIcon />
                <span>WhatsApp Us</span>
              </a>
              <a href={getCallLink()} className="btn-cta btn-call-cta">
                <img src={iconPhone} alt="" className="cta-icon-img" />
                <span>Call Now</span>
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="main-footer">
        <p>Managed by <span className="realty-brand">Nextron Realty</span></p>
      </footer>
    </div>
  )
}

export default App
