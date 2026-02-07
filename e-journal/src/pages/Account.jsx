import { useState } from "react";
import {
  User,
  Mail,
  Calendar,
  Palette,
  Image as ImageIcon,
  Edit2,
  Check,
  X,
  Camera,
} from "lucide-react";
import "../styles/Account.css";

function ProfileHeader({ profileImage, onImageChange, accentColor, textColor }) {
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onImageChange(file);
  };
  return (
    <div className="profile-header">
      <div
        className="profile-image-wrapper"
        style={{ border: `4px solid ${accentColor}` }}
      >
        <img src={profileImage} alt="Profile" className="profile-image" />
      </div>
      <label
        htmlFor="profile-upload"
        className="profile-upload-label"
        style={{ backgroundColor: accentColor, color: textColor }}
      >
        <Camera size={20} />
        <input
          id="profile-upload"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="profile-upload-input"
        />
      </label>
    </div>
  );
}

function EditableField({
  label,
  value,
  type = "text",
  onSave,
  accentColor,
  textColor,
  validator,
  error,
  setError,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    if (validator) {
      const validMsg = validator(editValue);
      if (validMsg) {
        setError && setError(validMsg);
        return;
      }
    }
    onSave(editValue);
    setIsEditing(false);
    setError && setError("");
  };
  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
    setError && setError("");
  };

  return (
    <div className="editable-field">
      <label className="field-label" style={{ color: textColor }}>{label}</label>
      {!isEditing ? (
        <div className="field-view">
          <div className="field-value" style={{ color: textColor }}>{value || "Not set"}</div>
          <button
            onClick={() => setIsEditing(true)}
            className="field-edit-button"
          >
            <Edit2 size={18} className="field-edit-button-icon" style={{ color: textColor }} />
          </button>
        </div>
      ) : (
        <div className="field-edit-mode">
          <input
            type={type}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            className="field-input"
            style={{ border: `2px solid ${accentColor}`, outlineColor: accentColor, color: textColor }}
            autoFocus
          />
          <button
            onClick={handleSave}
            className="field-save-button"
            style={{ backgroundColor: accentColor, color: textColor }}
          >
            <Check size={18} />
          </button>
          <button onClick={handleCancel} className="field-cancel-button">
            <X size={18} />
          </button>
        </div>
      )}
      {error && <div className="editable-field-error">{error}</div>}
    </div>
  );
}

const COLOR_PRESETS = [
  { name: "Lavender", color: "#e8d2e2" },
  { name: "Beige", color: "#F0EEEB" },
  { name: "Earth Brown", color: "#5D4B4B" },
  { name: "Light Slate", color: "#DDE6ED" },
  { name: "Olive Green", color: "#cbd183" },
  { name: "Soft Yellow", color: "#FFF1B5" },
];
const BACKGROUND_COLORS = [
  { name: "Lavender", color: "#e8d2e2" },
  { name: "Beige", color: "#F0EEEB" },
  { name: "Earth Brown", color: "#5D4B4B" },
  { name: "Light Slate", color: "#DDE6ED" },
  { name: "Olive Green", color: "#cbd183" },
  { name: "Soft Yellow", color: "#FFF1B5" },
];
const BACKGROUND_IMAGES = [
  { name: "Scott Pattern", url: "https://i.pinimg.com/736x/64/eb/18/64eb1837887b2dcb2b679d613dbc21a6.jpg" },
  { name: "Stripes1", url: "https://i.pinimg.com/1200x/dc/e7/2e/dce72eeb583a7cff9fc648b215d8dad9.jpg" },
  { name: "Polkadot", url: "https://i.pinimg.com/1200x/43/05/eb/4305eb0ada33adbdf20b6474a3ddbae7.jpg" },
  { name: "Stripes2", url: "https://i.pinimg.com/736x/88/7c/91/887c9105dcf49bc02470e19224ae450f.jpg" },
];
const EXISTING_USERNAMES = ["alex rivera", "user123", "minou"];
function getContrastColor(hexColor) {
  if (!hexColor) return '#5D4B4B';
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 170 ? "#F7F7F7" : "#5D4B4B";
}

export default function Account() {
  const [profileImage, setProfileImage] = useState("https://i.pinimg.com/736x/aa/7e/23/aa7e23dc1740c0303784aa096aa32966.jpg");
  const [username, setUsername] = useState("Alex Rivera");
  const [email, setEmail] = useState("alex.rivera@journal.app");
  const [birthday, setBirthday] = useState("1995-06-15");
  const [selectedColor, setSelectedColor] = useState("#5D4B4B");
  const [showCustomizePanel, setShowCustomizePanel] = useState(false);
  const [cardBgType, setCardBgType] = useState("color");
  const [cardBgColor, setCardBgColor] = useState("#F0EEEB");
  const [cardBgImage, setCardBgImage] = useState("");
  const [error, setError] = useState("");

  const validateUsername = (val) => {
    if (!val) return "Username is required";
    if (EXISTING_USERNAMES.includes(val.trim().toLowerCase()) && val.trim().toLowerCase() !== "alex rivera") {
      return "Username is already taken";
    }
    if (val.length < 3) return "Username must be at least 3 characters";
    if (/[^a-zA-Z0-9 _-]/.test(val)) return "Use only letters, numbers, _ or -";
    return "";
  };
  const validateEmail = (val) => {
    if (!val) return "Email is required";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val)) return "Invalid email format";
    return "";
  };
  const validateBirthday = (val) => {
    if (!val) return "Birthday is required";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return "Invalid date format";
    return "";
  };

  const headerTextColor = getContrastColor(selectedColor);
  const userInfoTextColor = cardBgType === 'color' ? getContrastColor(cardBgColor) : getContrastColor(cardBgColor);

  const handleImageChange = (file) => {
    const reader = new FileReader();
    reader.onloadend = () => setProfileImage(reader.result);
    reader.readAsDataURL(file);
  };
  const handleCardBgColor = (bgColor) => {
    setCardBgColor(bgColor);
    setCardBgType("color");
  };
  const handleCardBgImage = (bgUrl) => {
    setCardBgImage(bgUrl);
    setCardBgType("image");
  };
  const cardBackgroundStyle =
    cardBgType === "image" && cardBgImage
      ? {
          backgroundImage: `url(${cardBgImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : { backgroundColor: cardBgColor };

  return (
    <div className="account">
      <div className="app-container">
      <div className="decorative-blur-1" />
      <div className="decorative-blur-2" />
      <div className="content-wrapper">
        {/* Customize Panel */}
        <div className="customize-section">
          <div className="customize-button-wrapper">
            <button
              onClick={() => setShowCustomizePanel(!showCustomizePanel)}
              className="customize-button"
            >
              <Palette size={18} className="customize-button-icon" />
              <span className="customize-button-text">Customize</span>
            </button>
            {showCustomizePanel && (
              <div className="customize-panel">
                <div>
                  <p className="customize-section-header">Card Color</p>
                  <div className="color-grid">
                    {COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset.color}
                        onClick={() => setSelectedColor(preset.color)}
                        className="color-preset-button"
                        title={preset.name}
                      >
                        <div
                          className="color-preset-box"
                          style={{
                            backgroundColor: preset.color,
                            border:
                              selectedColor === preset.color
                                ? "3px solid #5D4B4B"
                                : "2px solid transparent",
                          }}
                        >
                          {selectedColor === preset.color && (
                            <Check className="color-preset-checkmark" size={19} style={{ color: getContrastColor(preset.color) }} />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="background-divider">
                  <p className="customize-section-header">Card Background</p>
                  <div className="bg-type-tabs">
                    <button
                      onClick={() => setCardBgType("color")}
                      className="bg-type-tab"
                      style={{
                        backgroundColor:
                          cardBgType === "color" ? selectedColor : "#F2ECC3",
                        color: cardBgType === "color" ? getContrastColor(selectedColor) : "#5D4B4B",
                      }}
                    >
                      Color
                    </button>
                    <button
                      onClick={() => setCardBgType("image")}
                      className="bg-type-tab"
                      style={{
                        backgroundColor:
                          cardBgType === "image" ? selectedColor : "#F2ECC3",
                        color: cardBgType === "image" ? getContrastColor(selectedColor) : "#5D4B4B",
                      }}
                    >
                      Image
                    </button>
                  </div>
                  {cardBgType === "color" && (
                    <div className="bg-color-grid">
                      {BACKGROUND_COLORS.map((bg) => (
                        <button
                          key={bg.color}
                          onClick={() => handleCardBgColor(bg.color)}
                          className="bg-color-button"
                          title={bg.name}
                        >
                          <div
                            className="bg-color-box"
                            style={{
                              backgroundColor: bg.color,
                              borderColor:
                                cardBgColor === bg.color &&
                                cardBgType === "color"
                                  ? "#5D4B4B"
                                  : "#E0E0E0",
                            }}
                          >
                            {cardBgColor === bg.color &&
                              cardBgType === "color" && (
                                <Check className="color-preset-checkmark" size={19} style={{ color: getContrastColor(bg.color) }} />
                              )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {cardBgType === "image" && (
                    <>
                      <div className="bg-image-grid">
                        {BACKGROUND_IMAGES.map((bg) => (
                          <button
                            key={bg.url}
                            onClick={() => handleCardBgImage(bg.url)}
                            className="bg-image-button"
                            title={bg.name}
                            style={{
                              border:
                                cardBgImage === bg.url &&
                                cardBgType === "image"
                                  ? "3px solid #5D4B4B"
                                  : "2px solid #E0E0E0",
                            }}
                          >
                            <img
                              src={bg.url}
                              alt={bg.name}
                              className="bg-image-img"
                            />
                            {cardBgImage === bg.url &&
                              cardBgType === "image" && (
                                <div className="bg-image-selected-overlay">
                                  <Check size={19} style={{ color: '#fff' }} />
                                </div>
                              )}
                          </button>
                        ))}
                      </div>
                      <label className="upload-button-label">
                        <div className="upload-button">
                          <ImageIcon
                            size={18}
                            className="upload-button-icon"
                          />
                          <span className="upload-button-text">
                            Upload Image
                          </span>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setCardBgImage(reader.result);
                                setCardBgType("image");
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="upload-input"
                        />
                      </label>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        {/* ID Card */}
        <div className="id-card" style={cardBackgroundStyle}>
          <div className="card-header" style={{ background: selectedColor }}>
            <div className="card-header-left">
              <div className="card-header-title-section">
                <h1 className="card-header-title" style={{ color: headerTextColor }}>
                  Dot Text Member
                </h1>
              </div>
            </div>
            <div className="card-header-right">
              <p className="card-header-since" style={{ color: `${headerTextColor}99` }}>
                Since
              </p>
              <p className="card-header-year" style={{ color: headerTextColor }}>
                2024
              </p>
            </div>
          </div>
          <div className="card-body">
            <div className="card-body-grid">
              <div className="profile-section">
                <ProfileHeader
                  profileImage={profileImage}
                  onImageChange={handleImageChange}
                  accentColor={selectedColor}
                  textColor={headerTextColor}
                />
              </div>
              <div className="details-section" style={{ color: userInfoTextColor }}>
                <div className="details-header">
                  <h2 className="details-title" style={{ color: userInfoTextColor }}>
                    Personal Details
                  </h2>
                  <p className="details-subtitle" style={{ color: userInfoTextColor }}>
                    Hover over fields to edit
                  </p>
                </div>
                {/* Username Field */}
                <div className="field-row">
                  <div
                    className="field-icon-wrapper"
                    style={{ backgroundColor: `${selectedColor}20` }}
                  >
                    <User style={{ color: userInfoTextColor }} size={20} />
                  </div>
                  <div className="field-content">
                    <EditableField
                      label="Full Name"
                      value={username}
                      onSave={setUsername}
                      accentColor={selectedColor}
                      textColor={userInfoTextColor}
                      validator={validateUsername}
                      error={error}
                      setError={setError}
                    />
                  </div>
                </div>
                {/* Email Field */}
                <div className="field-row">
                  <div
                    className="field-icon-wrapper"
                    style={{ backgroundColor: `${selectedColor}20` }}
                  >
                    <Mail style={{ color: userInfoTextColor }} size={20} />
                  </div>
                  <div className="field-content">
                    <EditableField
                      label="Email Address"
                      value={email}
                      type="email"
                      onSave={setEmail}
                      accentColor={selectedColor}
                      textColor={userInfoTextColor}
                      validator={validateEmail}
                      error={error}
                      setError={setError}
                    />
                  </div>
                </div>
                {/* Birthday Field */}
                <div className="field-row">
                  <div
                    className="field-icon-wrapper"
                    style={{ backgroundColor: `${selectedColor}20` }}
                  >
                    <Calendar style={{ color: userInfoTextColor }} size={20} />
                  </div>
                  <div className="field-content">
                    <EditableField
                      label="Date of Birth"
                      value={birthday}
                      type="date"
                      onSave={setBirthday}
                      accentColor={selectedColor}
                      textColor={userInfoTextColor}
                      validator={validateBirthday}
                      error={error}
                      setError={setError}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="card-footer" style={{ backgroundColor: selectedColor, borderTop: `2px solid ${selectedColor}20` }}>
            <div className="card-footer-content" style={{ color: `${headerTextColor}cc` }}>
              <p className="card-footer-text">This card represents your creative identity</p>
              <p className="card-footer-valid">Valid Forever</p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
