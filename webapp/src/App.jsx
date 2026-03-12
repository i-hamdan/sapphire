import React from 'react'
import InteractiveMap3D from './components/InteractiveMap3D'
import './App.css'

function App() {
  return (
    <div className="app-container">

      <main>
        <section className="map-section">
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
