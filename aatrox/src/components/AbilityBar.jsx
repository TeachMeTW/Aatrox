// AbilityBar.jsx
import React, { useState, useEffect } from 'react';
import './AbilityBar.css';

const AbilityBar = () => {
  // Q cycles through 3 images (1,2,3)
  const [qCycle, setQCycle] = useState(1);
  const [qCooldown, setQCooldown] = useState(false);
  const [wCooldown, setWCooldown] = useState(false);
  const [eCooldown, setECooldown] = useState(false);

  // Activation functions for each ability.
  const activateQ = () => {
    if (qCooldown) return; // already on cooldown
    setQCooldown(true);
    setTimeout(() => {
      setQCooldown(false);
      // Cycle through Q images: 1 → 2 → 3 → back to 1.
      setQCycle((prev) => (prev % 3) + 1);
    }, 1000);
  };

  const activateW = () => {
    if (wCooldown) return;
    setWCooldown(true);
    setTimeout(() => {
      setWCooldown(false);
    }, 1000);
  };

  const activateE = () => {
    if (eCooldown) return;
    setECooldown(true);
    setTimeout(() => {
      setECooldown(false);
    }, 1000);
  };

  // Listen for keyboard events instead of mouse clicks.
  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.key.toLowerCase()) {
        case 'q':
          activateQ();
          break;
        case 'w':
          activateW();
          break;
        case 'e':
          activateE();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [qCooldown, wCooldown, eCooldown]);

  // Return the correct image URL for Q based on the current cycle.
  const getQImage = () => `/images/q${qCycle}.png`;
  const getWImage = () => `/images/w.png`;
  const getEImage = () => `/images/e.png`;

  return (
    <div className="ability-bar">
      {/* Q Ability */}
      <div className="ability">
        <div className="ability-image-container">
          <img src={getQImage()} alt={`Q Ability ${qCycle}`} />
          {qCooldown && <div className="cooldown-overlay"></div>}
        </div>
      </div>
      
      {/* W Ability */}
      <div className="ability">
        <div className="ability-image-container">
          <img src={getWImage()} alt="W Ability" />
          {wCooldown && <div className="cooldown-overlay"></div>}
        </div>
      </div>
      
      {/* E Ability */}
      <div className="ability">
        <div className="ability-image-container">
          <img src={getEImage()} alt="E Ability" />
          {eCooldown && <div className="cooldown-overlay"></div>}
        </div>
      </div>
    </div>
  );
};

export default AbilityBar;
