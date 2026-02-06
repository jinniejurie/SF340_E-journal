import { useState } from "react";
import {
  Sparkles,
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
      <label className="field-label">{label}</label>
      {!isEditing ? (
        <div className="field-view">
          <div className="field-value">{value || "Not set"}</div>
          <button
            onClick={() => setIsEditing(true)}
            className="field-edit-button"
          >
            <Edit2 size={18} className="field-edit-button-icon" />
          </button>
        </div>
      ) : (
        <div className="field-edit-mode">
          <input
            type={type}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            className="field-input"
            style={{ border: `2px solid ${accentColor}`, outlineColor: accentColor }}
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
  { name: "Default Earth", color: "#5D4B4B" },
  { name: "Sunset Orange", color: "#E36A3F" },
  { name: "Deep Wine", color: "#702E26" },
  { name: "Soft Lavender", color: "#CCD8FF" },
  { name: "Warm Cream", color: "#F2ECC3" },
  { name: "Lilac Dream", color: "#DCC9F7" },
];
const BACKGROUND_COLORS = [
  { name: "White", color: "#FFFFFF" },
  { name: "Warm Beige", color: "#F0EEEB" },
  { name: "Soft Pink", color: "#F5E6E8" },
  { name: "Light Sage", color: "#E8F3E8" },
  { name: "Pale Blue", color: "#E8F4F8" },
  { name: "Cream", color: "#FFF8E7" },
];
const BACKGROUND_IMAGES = [
  { name: "Abstract Art", url: "https://images.unsplash.com/photo-1667980930112-4d1157f62892?auto=format&fit=crop&w=800&q=80" },
  { name: "Minimal Beige", url: "https://images.unsplash.com/photo-1638303322579-343c8154b80e?auto=format&fit=crop&w=800&q=80" },
  { name: "Watercolor", url: "https://images.unsplash.com/photo-1606385887663-6f42177f5c3b?auto=format&fit=crop&w=800&q=80" },
  { name: "Marble", url: "https://images.unsplash.com/photo-1669102046402-7c5e93766565?auto=format&fit=crop&w=800&q=80" },
];
const EXISTING_USERNAMES = ["alex rivera", "user123", "minou"];
function getContrastColor(hexColor) {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155 ? "#2D2D2D" : "#F0EEEB";
}

export default function Account() {
  const [profileImage, setProfileImage] = useState(
    "https://images.unsplash.com/photo-1734983358017-3f91bc716b0a?auto=format&fit=crop&w=332&q=80"
  );
  const [username, setUsername] = useState("Alex Rivera");
  const [email, setEmail] = useState("alex.rivera@journal.app");
  const [birthday, setBirthday] = useState("1995-06-15");
  const [selectedColor, setSelectedColor] = useState("#5D4B4B");
  const [showCustomizePanel, setShowCustomizePanel] = useState(false);
  const [cardBgType, setCardBgType] = useState("color");
  const [cardBgColor, setCardBgColor] = useState("#F7F7F7");
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
  const textColor = getContrastColor(selectedColor);
  const handleImageChange = (file) => {
    const reader = new FileReader();
    reader.onloadend = () => setProfileImage(reader.result);
    reader.readAsDataURL(file);
  };
  const handleCardBgImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCardBgImage(reader.result);
        setCardBgType("image");
      };
      reader.readAsDataURL(file);
    }
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
                            <span
                              style={{ color: getContrastColor(preset.color) }}
                              className="color-preset-checkmark"
                            >
                              ✓
                            </span>
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
                        color: cardBgType === "color" ? textColor : "#5D4B4B",
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
                        color: cardBgType === "image" ? textColor : "#5D4B4B",
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
                          onClick={() => {
                            setCardBgColor(bg.color);
                            setCardBgType("color");
                          }}
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
                                <span
                                  className="color-preset-checkmark"
                                  style={{ color: "#5D4B4B" }}
                                >
                                  ✓
                                </span>
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
                            onClick={() => {
                              setCardBgImage(bg.url);
                              setCardBgType("image");
                            }}
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
                                  <span className="bg-image-checkmark">✓</span>
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
                          onChange={handleCardBgImageUpload}
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
          <div
            className="card-header"
            style={{ background: `linear-gradient(to right, ${selectedColor}, ${selectedColor}dd)` }}
          >
            <div className="card-header-left">
              <Sparkles style={{ color: textColor }} size={28} />
              <div className="card-header-title-section">
                <h1 className="card-header-title" style={{ color: textColor }}>
                  Journaly Member
                </h1>
                <p
                  className="card-header-subtitle"
                  style={{ color: `${textColor}cc` }}
                >
                  Creative Identity
                </p>
              </div>
            </div>
            <div className="card-header-right">
              <p
                className="card-header-since"
                style={{ color: `${textColor}99` }}
              >
                Since
              </p>
              <p className="card-header-year" style={{ color: textColor }}>
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
                  textColor={textColor}
                />
              </div>
              <div className="details-section">
                <div className="details-header">
                  <h2 className="details-title">Personal Details</h2>
                  <p className="details-subtitle">Hover over fields to edit</p>
                </div>
                {/* Username Field */}
                <div className="field-row">
                  <div
                    className="field-icon-wrapper"
                    style={{ backgroundColor: `${selectedColor}20` }}
                  >
                    <User style={{ color: selectedColor }} size={20} />
                  </div>
                  <div className="field-content">
                    <EditableField
                      label="Full Name"
                      value={username}
                      onSave={setUsername}
                      accentColor={selectedColor}
                      textColor={textColor}
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
                    <Mail style={{ color: selectedColor }} size={20} />
                  </div>
                  <div className="field-content">
                    <EditableField
                      label="Email Address"
                      value={email}
                      type="email"
                      onSave={setEmail}
                      accentColor={selectedColor}
                      textColor={textColor}
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
                    <Calendar style={{ color: selectedColor }} size={20} />
                  </div>
                  <div className="field-content">
                    <EditableField
                      label="Date of Birth"
                      value={birthday}
                      type="date"
                      onSave={setBirthday}
                      accentColor={selectedColor}
                      textColor={textColor}
                      validator={validateBirthday}
                      error={error}
                      setError={setError}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div
            className="card-footer"
            style={{
              backgroundColor: `${selectedColor}15`,
              borderTop: `2px solid ${selectedColor}20`,
            }}
          >
            <div
              className="card-footer-content"
              style={{ color: `${selectedColor}cc` }}
            >
              <p className="card-footer-text">
                This card represents your creative identity
              </p>
              <p className="card-footer-valid">Valid Forever</p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
