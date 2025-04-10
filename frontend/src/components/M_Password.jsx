import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const M_Password = ({ closeModal }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = () => {
    if (password === 'admin123') {
      closeModal();
      navigate('/settings'); 
    } else {
      setError('Incorrect password');
    }
  };

  const handleClose = () => {
    navigate('/printer'); 
  };

  return (
    <div className="modal modal-open modal-bottom sm:modal-middle">
      <div className="modal-box relative">
        <button 
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          onClick={handleClose}
        >
          ✕
        </button>
        
        <h3 className="font-bold text-lg text-center mb-4">Enter Password</h3>
        
        <div className="form-control w-full">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input input-bordered w-full"
            placeholder="Enter your password"
          />
          {error && <label className="label">
            <span className="label-text-alt text-error">{error}</span>
          </label>}
        </div>

        <div className="modal-action">
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
          >
            Submit
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={handleClose}></div>
    </div>
  );
};

export default M_Password;
