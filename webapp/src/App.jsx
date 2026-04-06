import React from 'react'
import InteractiveMap3D from './components/InteractiveMap3D'
import './App.css'
import heroVideo from './assets/hero-bg.mp4'
import logo from './assets/logos/transparent_logo.png'

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
          <h1>Experience Luxury Living</h1>
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

        <section className="amenities-section">
          <h2>Premium Amenities</h2>
          <div className="amenities-grid">
            {['Grand Entrance', 'Lush Green Gardens', 'Clubhouse & Gazebos', 'Wide concrete roads', 'Vastu Compliant', '24x7 Security'].map((item, i) => (
              <div key={i} className="amenity-card">
                <div className="amenity-icon">✨</div>
                <h3>{item}</h3>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
