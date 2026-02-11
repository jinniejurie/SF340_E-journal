import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Resizable } from 're-resizable'
import { 
  Type, 
  Square, 
  Image as ImageIcon, 
  Download, 
  Share2, 
  Undo2, 
  Redo2, 
  ChevronLeft,
  Triangle,
  Star,
  Minus,
  Circle,
  Sticker,
  Trash2,
  Palette,
  Copy,
  Scissors,
  Maximize2,
  ArrowDown,
  ArrowUp
} from 'lucide-react'
import '../styles/Note.css'

// Import sticker images
import sticker4 from '../assets/stickers/sticker4.png'
import sticker5 from '../assets/stickers/sticker5.png'
import sticker6 from '../assets/stickers/sticker6.png'
import sticker7 from '../assets/stickers/sticker7.png'
import sticker8 from '../assets/stickers/sticker8.png'
import sticker9 from '../assets/stickers/sticker9.png'
import sticker10 from '../assets/stickers/sticker10.png'

const STICKERS = [
  sticker4,
  sticker5,
  sticker6,
  sticker7,
  sticker8,
  sticker9,
  sticker10
]

function Note() {
  const navigate = useNavigate()
  const location = useLocation()
  
  // Get the latest note from localStorage
  const getLatestNote = () => {
    try {
      const stored = localStorage.getItem('ejournal-notes')
      if (stored) {
        const notes = JSON.parse(stored)
        // Get the most recent note
        const allNotes = Object.values(notes).flat()
        if (allNotes.length > 0) {
          const sortedNotes = allNotes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          return sortedNotes[0]
        }
      }
    } catch (e) {}
    return null
  }

  // Get tags from localStorage
  const getTags = () => {
    try {
      const stored = localStorage.getItem('ejournal-tags')
      if (stored) return JSON.parse(stored)
    } catch (e) {}
    return []
  }

  const latestNote = getLatestNote()
  const tags = getTags()
  const noteTag = latestNote && latestNote.tag ? tags.find(t => t.id === latestNote.tag.id) || latestNote.tag : null

  const [title, setTitle] = useState(latestNote?.name || '23 January 2026')
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [tagName, setTagName] = useState(noteTag?.name || '🪰 Aura Loss')
  const [tagColor, setTagColor] = useState(noteTag?.color || '#FF6B6B')
  const [isEditingTag, setIsEditingTag] = useState(false)
  const [isEditingTagColor, setIsEditingTagColor] = useState(false)
  const [showTagSelector, setShowTagSelector] = useState(false)
  const [isCreatingNewTag, setIsCreatingNewTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#FF6B6B')
  const [textBoxes, setTextBoxes] = useState([])
  const [shapes, setShapes] = useState([])
  const [images, setImages] = useState([])
  const [stickers, setStickers] = useState([])
  const [maxZIndex, setMaxZIndex] = useState(1)
  const [showShapesMenu, setShowShapesMenu] = useState(false)
  const [showStickersMenu, setShowStickersMenu] = useState(false)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showShareMenu, setShowShareMenu] = useState(false)
  const [isAddingTextBox, setIsAddingTextBox] = useState(false)
  const [isSaved, setIsSaved] = useState(true)
  const [versions, setVersions] = useState([])
  const [currentVersionIndex, setCurrentVersionIndex] = useState(-1)
  const [selectedItem, setSelectedItem] = useState(null)
  const [showColorPicker, setShowColorPicker] = useState(false)
  
  // Close menus when selecting different item type
  const handleSelectItem = (item) => {
    setSelectedItem(item);
    // Close all menus when selecting an item
    if (item) {
      // Only show color picker if selecting a shape
      if (item.type !== 'shape') {
        setShowColorPicker(false);
      } else {
        // If selecting a shape, close other menus but keep color picker if it was open
        // (don't auto-open it, just keep its state)
      }
      // Always close dropdown menus when selecting an item
      setShowShareMenu(false);
      setShowShapesMenu(false);
      setShowStickersMenu(false);
    } else {
      // If deselecting, close all menus
      setShowColorPicker(false);
      setShowShareMenu(false);
      setShowShapesMenu(false);
      setShowStickersMenu(false);
    }
  };
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [contextMenu, setContextMenu] = useState(null)
  const [clipboard, setClipboard] = useState(null)
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false)
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const activeDragHandlersRef = useRef({ mouseMove: null, mouseUp: null, contextMenu: null })
  const isRightClickRef = useRef(false)

  // Sync with latest note and tags when component mounts or when notes/tags change
  useEffect(() => {
    const latestNote = getLatestNote()
    const tags = getTags()
    const noteTag = latestNote && latestNote.tag ? tags.find(t => t.id === latestNote.tag.id) || latestNote.tag : null
    
    if (latestNote) {
      setTitle(latestNote.name)
    }
    if (noteTag) {
      setTagName(noteTag.name)
      setTagColor(noteTag.color)
    }
  }, [location.pathname])

  // Listen for storage changes to sync in real-time
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'ejournal-notes') {
        const latestNote = getLatestNote()
        if (latestNote) {
          setTitle(latestNote.name)
        }
      }
      if (e.key === 'ejournal-tags') {
        const tags = getTags()
        const latestNote = getLatestNote()
        const noteTag = latestNote && latestNote.tag ? tags.find(t => t.id === latestNote.tag.id) || latestNote.tag : null
        if (noteTag) {
          setTagName(noteTag.name)
          setTagColor(noteTag.color)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  // Update note name in localStorage when title changes
  useEffect(() => {
    if (latestNote) {
      try {
        const stored = localStorage.getItem('ejournal-notes')
        if (stored) {
          const notes = JSON.parse(stored)
          const dateKey = latestNote.date
          if (notes[dateKey]) {
            const updatedNotes = notes[dateKey].map(n => 
              n.id === latestNote.id ? { ...n, name: title } : n
            )
            notes[dateKey] = updatedNotes
            localStorage.setItem('ejournal-notes', JSON.stringify(notes))
          }
        }
      } catch (e) {}
    }
  }, [title])

  // Update tag in localStorage when tag changes
  const updateTagInStorage = (newName, newColor) => {
    if (latestNote && noteTag) {
      try {
        const tags = getTags()
        const updatedTags = tags.map(t => 
          t.id === noteTag.id ? { ...t, name: newName, color: newColor } : t
        )
        localStorage.setItem('ejournal-tags', JSON.stringify(updatedTags))
        
        // Also update the note's tag reference
        const stored = localStorage.getItem('ejournal-notes')
        if (stored) {
          const notes = JSON.parse(stored)
          const dateKey = latestNote.date
          if (notes[dateKey]) {
            const updatedNotes = notes[dateKey].map(n => {
              if (n.id === latestNote.id && n.tag) {
                return { ...n, tag: { ...n.tag, name: newName, color: newColor } }
              }
              return n
            })
            notes[dateKey] = updatedNotes
            localStorage.setItem('ejournal-notes', JSON.stringify(notes))
          }
        }
      } catch (e) {}
    }
  }

  // Create new tag
  const createNewTag = () => {
    if (newTagName.trim()) {
      const tags = getTags()
      const newTag = {
        id: Date.now().toString(),
        name: newTagName,
        color: newTagColor
      }
      const updatedTags = [...tags, newTag]
      localStorage.setItem('ejournal-tags', JSON.stringify(updatedTags))
      
      // Update note to use new tag
      const currentLatestNote = getLatestNote()
      if (currentLatestNote) {
        try {
          const stored = localStorage.getItem('ejournal-notes')
          if (stored) {
            const notes = JSON.parse(stored)
            const dateKey = currentLatestNote.date
            if (notes[dateKey]) {
              const updatedNotes = notes[dateKey].map(n => {
                if (n.id === currentLatestNote.id) {
                  return { ...n, tag: newTag }
                }
                return n
              })
              notes[dateKey] = updatedNotes
              localStorage.setItem('ejournal-notes', JSON.stringify(notes))
            }
          }
        } catch (e) {
          console.error('Error creating tag:', e)
        }
      }
      
      setTagName(newTagName)
      setTagColor(newTagColor)
      setNewTagName('')
      setNewTagColor('#FF6B6B')
      setIsCreatingNewTag(false)
      setShowTagSelector(false)
    }
  }

  // Select existing tag
  const selectTag = (tag) => {
    const currentLatestNote = getLatestNote()
    if (currentLatestNote) {
      try {
        const stored = localStorage.getItem('ejournal-notes')
        if (stored) {
          const notes = JSON.parse(stored)
          const dateKey = currentLatestNote.date
          if (notes[dateKey]) {
            const updatedNotes = notes[dateKey].map(n => {
              if (n.id === currentLatestNote.id) {
                return { ...n, tag: tag }
              }
              return n
            })
            notes[dateKey] = updatedNotes
            localStorage.setItem('ejournal-notes', JSON.stringify(notes))
          }
        }
      } catch (e) {
        console.error('Error updating tag:', e)
      }
    }
    setTagName(tag.name)
    setTagColor(tag.color)
    setShowTagSelector(false)
    setIsCreatingNewTag(false)
  }

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger shortcuts when typing in inputs/textareas
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        // Allow normal typing, but still handle Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X in textareas
        if (e.target.tagName === 'TEXTAREA') {
          const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
          const modifier = isMac ? e.metaKey : e.ctrlKey;
          
          if (modifier && e.key === 'c') {
            // Copy text in textarea - let browser handle it
            return;
          }
          if (modifier && e.key === 'v') {
            // Paste text in textarea - let browser handle it
            return;
          }
          if (modifier && e.key === 'x') {
            // Cut text in textarea - let browser handle it
            return;
          }
          if (modifier && e.key === 'a') {
            // Select all text in textarea - let browser handle it
            return;
          }
        }
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      // Delete/Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItem && !isEditingTitle && !isEditingTag && !isEditingTagColor) {
        e.preventDefault()
        if (selectedItem.type === 'textbox') {
          deleteTextBox(selectedItem.id)
        } else if (selectedItem.type === 'shape') {
          deleteShape(selectedItem.id)
        } else if (selectedItem.type === 'image') {
          deleteImage(selectedItem.id)
        } else if (selectedItem.type === 'sticker') {
          deleteSticker(selectedItem.id)
        }
      }
      // Copy (Ctrl+C / Cmd+C)
      else if (modifier && e.key === 'c' && selectedItem) {
        e.preventDefault();
        copyItem();
      }
      // Cut (Ctrl+X / Cmd+X)
      else if (modifier && e.key === 'x' && selectedItem) {
        e.preventDefault();
        cutItem();
      }
      // Paste (Ctrl+V / Cmd+V)
      else if (modifier && e.key === 'v' && clipboard) {
        e.preventDefault();
        pasteItem();
      }
      // Duplicate (Ctrl+D / Cmd+D)
      else if (modifier && e.key === 'd' && selectedItem) {
        e.preventDefault();
        duplicateItem();
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedItem, isEditingTitle, isEditingTag, isEditingTagColor, clipboard])

  const saveVersion = (description) => {
    const newVersion = {
      id: Date.now().toString(),
      timestamp: new Date(),
      description,
      state: {
        textBoxes: [...textBoxes],
        shapes: [...shapes],
        images: [...images],
        stickers: [...stickers],
        title,
        tagName,
        tagColor
      }
    };
    
    const newVersions = [...versions.slice(0, currentVersionIndex + 1), newVersion];
    setVersions(newVersions);
    setCurrentVersionIndex(newVersions.length - 1);
    setIsSaved(true);
  };

  const handleSave = () => {
    // Save current state as a version if there are unsaved changes
    if (!isSaved) {
      saveVersion('Manual save');
    }
    // Navigate to /calendar/note
    navigate('/calendar/note');
  };

  const restoreVersion = (index) => {
    const version = versions[index];
    setTextBoxes(version.state.textBoxes);
    setShapes(version.state.shapes);
    setImages(version.state.images);
    setStickers(version.state.stickers);
    setTitle(version.state.title);
    setTagName(version.state.tagName || version.state.tag || '');
    setTagColor(version.state.tagColor || '#FF6B6B');
    setCurrentVersionIndex(index);
    setIsSaved(true);
  };

  const handleUndo = () => {
    if (currentVersionIndex > 0) {
      restoreVersion(currentVersionIndex - 1);
    }
  };

  const handleRedo = () => {
    if (currentVersionIndex < versions.length - 1) {
      restoreVersion(currentVersionIndex + 1);
    }
  };

  const handleCanvasClick = (e) => {
    // Deselect when clicking on canvas (not on any element)
    if (e.target === canvasRef.current || e.target.classList.contains('note-content')) {
      handleSelectItem(null);
      setIsDragging(false);
    }
    
    // Reset dragging state when clicking on canvas
    setIsDragging(false);
    
    if (!isAddingTextBox || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const newTextBoxId = Date.now().toString();
    const newZIndex = maxZIndex + 1;
    const newTextBox = {
      id: newTextBoxId,
      content: '',
      x,
      y,
      width: 200,
      height: 100,
      zIndex: newZIndex
    };
    
    setMaxZIndex(newZIndex);
    setTextBoxes([...textBoxes, newTextBox]);
    handleSelectItem({ type: 'textbox', id: newTextBoxId });
    setIsAddingTextBox(false);
    setIsSaved(false);
    saveVersion('Added text box');
  };

  const addShape = (type, clickX = null, clickY = null) => {
    let x = 400;
    let y = 300;
    
    // If click position provided, use it
    if (clickX !== null && clickY !== null && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      x = clickX - rect.left;
      y = clickY - rect.top;
    }
    
    const newZIndex = maxZIndex + 1;
    const newShape = {
      id: Date.now().toString(),
      type,
      x,
      y,
      width: type === 'line' ? 200 : 100,
      height: type === 'line' ? 2 : 100,
      fillColor: 'transparent',
      strokeColor: '#3A3030',
      strokeWidth: 2,
      zIndex: newZIndex
    };
    
    setMaxZIndex(newZIndex);
    setShapes([...shapes, newShape]);
    handleSelectItem({ type: 'shape', id: newShape.id });
    setShowShapesMenu(false);
    setIsSaved(false);
    saveVersion(`Added ${type} shape`);
  };

  const addSticker = (stickerSrc, clickX = null, clickY = null) => {
    let x = 300;
    let y = 400;
    
    // If click position provided, use it
    if (clickX !== null && clickY !== null && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      x = clickX - rect.left;
      y = clickY - rect.top;
    }
    
    const newZIndex = maxZIndex + 1;
    const newSticker = {
      id: Date.now().toString(),
      src: stickerSrc,
      x,
      y,
      width: 150,
      height: 150,
      rotation: Math.random() * 20 - 10,
      zIndex: newZIndex
    };
    
    setMaxZIndex(newZIndex);
    setStickers([...stickers, newSticker]);
    handleSelectItem({ type: 'sticker', id: newSticker.id });
    setShowStickersMenu(false);
    setIsSaved(false);
    saveVersion('Added sticker');
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const newZIndex = maxZIndex + 1;
      const newImage = {
        id: Date.now().toString(),
        src: event.target?.result,
        x: 300,
        y: 300,
        width: 300,
        height: 200,
        rotation: 0,
        zIndex: newZIndex
      };
      
      setMaxZIndex(newZIndex);
      setImages([...images, newImage]);
      setIsSaved(false);
      saveVersion('Added image');
    };
    reader.readAsDataURL(file);
  };

  const deleteTextBox = (id) => {
    setTextBoxes(textBoxes.filter(tb => tb.id !== id));
    setSelectedItem(null);
    setIsSaved(false);
    saveVersion('Deleted text box');
  };

  const deleteShape = (id) => {
    setShapes(shapes.filter(s => s.id !== id));
    setSelectedItem(null);
    setIsSaved(false);
    saveVersion('Deleted shape');
  };

  const deleteSticker = (id) => {
    setStickers(stickers.filter(s => s.id !== id));
    setSelectedItem(null);
    setIsSaved(false);
    saveVersion('Deleted sticker');
  };

  const deleteImage = (id) => {
    setImages(images.filter(i => i.id !== id));
    setSelectedItem(null);
    setIsSaved(false);
    saveVersion('Deleted image');
  };

  // Function to stop all dragging
  const stopAllDragging = () => {
    setIsDragging(false);
    isRightClickRef.current = false;
    // Remove any active drag handlers
    if (activeDragHandlersRef.current.mouseMove) {
      document.removeEventListener('mousemove', activeDragHandlersRef.current.mouseMove);
      activeDragHandlersRef.current.mouseMove = null;
    }
    if (activeDragHandlersRef.current.mouseUp) {
      document.removeEventListener('mouseup', activeDragHandlersRef.current.mouseUp);
      activeDragHandlersRef.current.mouseUp = null;
    }
    if (activeDragHandlersRef.current.contextMenu) {
      document.removeEventListener('contextmenu', activeDragHandlersRef.current.contextMenu);
      activeDragHandlersRef.current.contextMenu = null;
    }
  };

  // Context menu functions
  const handleContextMenu = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Stop any ongoing dragging immediately
    stopAllDragging();
    setIsContextMenuOpen(true);
    
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      item: item
    });
  };

  const handleCanvasContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsContextMenuOpen(true);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      item: null // null means canvas/empty space
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
    setIsContextMenuOpen(false);
  };

  const copyItem = () => {
    if (!selectedItem) return;
    
    let itemData = null;
    if (selectedItem.type === 'textbox') {
      itemData = { type: 'textbox', data: textBoxes.find(tb => tb.id === selectedItem.id) };
    } else if (selectedItem.type === 'shape') {
      itemData = { type: 'shape', data: shapes.find(s => s.id === selectedItem.id) };
    } else if (selectedItem.type === 'image') {
      itemData = { type: 'image', data: images.find(i => i.id === selectedItem.id) };
    } else if (selectedItem.type === 'sticker') {
      itemData = { type: 'sticker', data: stickers.find(s => s.id === selectedItem.id) };
    }
    
    if (itemData) {
      setClipboard(itemData);
    }
    closeContextMenu();
  };

  const cutItem = () => {
    copyItem();
    if (selectedItem) {
      if (selectedItem.type === 'textbox') {
        deleteTextBox(selectedItem.id);
      } else if (selectedItem.type === 'shape') {
        deleteShape(selectedItem.id);
      } else if (selectedItem.type === 'image') {
        deleteImage(selectedItem.id);
      } else if (selectedItem.type === 'sticker') {
        deleteSticker(selectedItem.id);
      }
    }
  };

  const pasteItem = () => {
    if (!clipboard) return;
    
    const offset = 20;
    const newZIndex = maxZIndex + 1;
    if (clipboard.type === 'textbox') {
      const newItem = {
        ...clipboard.data,
        id: Date.now().toString(),
        x: clipboard.data.x + offset,
        y: clipboard.data.y + offset,
        zIndex: newZIndex
      };
      setMaxZIndex(newZIndex);
      setTextBoxes([...textBoxes, newItem]);
      handleSelectItem({ type: 'textbox', id: newItem.id });
    } else if (clipboard.type === 'shape') {
      const newItem = {
        ...clipboard.data,
        id: Date.now().toString(),
        x: clipboard.data.x + offset,
        y: clipboard.data.y + offset,
        zIndex: newZIndex
      };
      setMaxZIndex(newZIndex);
      setShapes([...shapes, newItem]);
      handleSelectItem({ type: 'shape', id: newItem.id });
    } else if (clipboard.type === 'image') {
      const newItem = {
        ...clipboard.data,
        id: Date.now().toString(),
        x: clipboard.data.x + offset,
        y: clipboard.data.y + offset,
        zIndex: newZIndex
      };
      setMaxZIndex(newZIndex);
      setImages([...images, newItem]);
      handleSelectItem({ type: 'image', id: newItem.id });
    } else if (clipboard.type === 'sticker') {
      const newItem = {
        ...clipboard.data,
        id: Date.now().toString(),
        x: clipboard.data.x + offset,
        y: clipboard.data.y + offset,
        zIndex: newZIndex
      };
      setMaxZIndex(newZIndex);
      setStickers([...stickers, newItem]);
      handleSelectItem({ type: 'sticker', id: newItem.id });
    }
    setIsSaved(false);
    saveVersion('Pasted item');
    closeContextMenu();
  };

  const duplicateItem = () => {
    if (!selectedItem) return;
    
    const offset = 20;
    const newZIndex = maxZIndex + 1;
    if (selectedItem.type === 'textbox') {
      const original = textBoxes.find(tb => tb.id === selectedItem.id);
      if (original) {
        const newItem = {
          ...original,
          id: Date.now().toString(),
          x: original.x + offset,
          y: original.y + offset,
          zIndex: newZIndex
        };
        setMaxZIndex(newZIndex);
        setTextBoxes([...textBoxes, newItem]);
        handleSelectItem({ type: 'textbox', id: newItem.id });
      }
    } else if (selectedItem.type === 'shape') {
      const original = shapes.find(s => s.id === selectedItem.id);
      if (original) {
        const newItem = {
          ...original,
          id: Date.now().toString(),
          x: original.x + offset,
          y: original.y + offset,
          zIndex: newZIndex
        };
        setMaxZIndex(newZIndex);
        setShapes([...shapes, newItem]);
        handleSelectItem({ type: 'shape', id: newItem.id });
      }
    } else if (selectedItem.type === 'image') {
      const original = images.find(i => i.id === selectedItem.id);
      if (original) {
        const newItem = {
          ...original,
          id: Date.now().toString(),
          x: original.x + offset,
          y: original.y + offset,
          zIndex: newZIndex
        };
        setMaxZIndex(newZIndex);
        setImages([...images, newItem]);
        handleSelectItem({ type: 'image', id: newItem.id });
      }
    } else if (selectedItem.type === 'sticker') {
      const original = stickers.find(s => s.id === selectedItem.id);
      if (original) {
        const newItem = {
          ...original,
          id: Date.now().toString(),
          x: original.x + offset,
          y: original.y + offset,
          zIndex: newZIndex
        };
        setMaxZIndex(newZIndex);
        setStickers([...stickers, newItem]);
        handleSelectItem({ type: 'sticker', id: newItem.id });
      }
    }
    setIsSaved(false);
    saveVersion('Duplicated item');
    closeContextMenu();
  };

  // Get all elements with their z-index for ordering
  const getAllElements = () => {
    const allElements = [
      ...textBoxes.map(tb => ({ ...tb, elementType: 'textbox' })),
      ...shapes.map(s => ({ ...s, elementType: 'shape' })),
      ...images.map(i => ({ ...i, elementType: 'image' })),
      ...stickers.map(s => ({ ...s, elementType: 'sticker' }))
    ];
    return allElements.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  };

  const sendToBack = () => {
    if (!selectedItem) return;
    
    const allElements = getAllElements();
    // Find the minimum zIndex among all elements (excluding the selected one)
    const otherElements = allElements.filter(el => {
      if (selectedItem.type === 'textbox') return el.elementType !== 'textbox' || el.id !== selectedItem.id;
      if (selectedItem.type === 'shape') return el.elementType !== 'shape' || el.id !== selectedItem.id;
      if (selectedItem.type === 'image') return el.elementType !== 'image' || el.id !== selectedItem.id;
      if (selectedItem.type === 'sticker') return el.elementType !== 'sticker' || el.id !== selectedItem.id;
      return true;
    });
    
    // Set zIndex to be the minimum among other elements, or 1 if no other elements
    // Use 1 as minimum to ensure element is visible above background
    const minZIndex = otherElements.length > 0 
      ? Math.min(...otherElements.map(el => el.zIndex || 1))
      : 1;
    
    // If minZIndex is already 1, keep it at 1 (don't go below 1)
    // Otherwise, set to minZIndex - 1 to place it behind other elements
    const newZIndex = minZIndex <= 1 ? 1 : minZIndex - 1;
    
    if (selectedItem.type === 'textbox') {
      setTextBoxes(textBoxes.map(tb => 
        tb.id === selectedItem.id ? { ...tb, zIndex: newZIndex } : tb
      ));
    } else if (selectedItem.type === 'shape') {
      setShapes(shapes.map(s => 
        s.id === selectedItem.id ? { ...s, zIndex: newZIndex } : s
      ));
    } else if (selectedItem.type === 'image') {
      setImages(images.map(i => 
        i.id === selectedItem.id ? { ...i, zIndex: newZIndex } : i
      ));
    } else if (selectedItem.type === 'sticker') {
      setStickers(stickers.map(s => 
        s.id === selectedItem.id ? { ...s, zIndex: newZIndex } : s
      ));
    }
    
    setIsSaved(false);
    saveVersion('Sent to back');
    closeContextMenu();
  };

  const bringToFront = () => {
    if (!selectedItem) return;
    
    const newZIndex = maxZIndex + 1;
    
    if (selectedItem.type === 'textbox') {
      setTextBoxes(textBoxes.map(tb => 
        tb.id === selectedItem.id ? { ...tb, zIndex: newZIndex } : tb
      ));
    } else if (selectedItem.type === 'shape') {
      setShapes(shapes.map(s => 
        s.id === selectedItem.id ? { ...s, zIndex: newZIndex } : s
      ));
    } else if (selectedItem.type === 'image') {
      setImages(images.map(i => 
        i.id === selectedItem.id ? { ...i, zIndex: newZIndex } : i
      ));
    } else if (selectedItem.type === 'sticker') {
      setStickers(stickers.map(s => 
        s.id === selectedItem.id ? { ...s, zIndex: newZIndex } : s
      ));
    }
    
    setMaxZIndex(newZIndex);
    setIsSaved(false);
    saveVersion('Brought to front');
    closeContextMenu();
  };

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClick = () => closeContextMenu();
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  const updateShapeColor = (id, fillColor, strokeColor) => {
    setShapes(shapes.map(s => s.id === id ? { ...s, fillColor, strokeColor } : s));
    setIsSaved(false);
  };

  const updateShapeStroke = (id, strokeWidth) => {
    setShapes(shapes.map(s => s.id === id ? { ...s, strokeWidth } : s));
    setIsSaved(false);
  };

  const downloadAsPDF = () => {
    alert('Download as PDF - In production, this would generate a PDF of the note');
  };

  const shareAsLink = () => {
    const link = window.location.href;
    navigator.clipboard.writeText(link);
    alert('Link copied to clipboard!');
  };

  const getSelectedShape = () => {
    if (selectedItem?.type === 'shape') {
      return shapes.find(s => s.id === selectedItem.id);
    }
    return null;
  };

  const renderShape = (shape) => {
    const isSelected = selectedItem?.type === 'shape' && selectedItem.id === shape.id;
    
    const shapeContent = () => {
      switch (shape.type) {
        case 'rectangle':
          return (
            <div
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: shape.fillColor,
                border: `${shape.strokeWidth}px solid ${shape.strokeColor}`
              }}
            />
          );
        case 'circle':
          return (
            <div
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: shape.fillColor,
                borderRadius: '50%',
                border: `${shape.strokeWidth}px solid ${shape.strokeColor}`
              }}
            />
          );
        case 'triangle':
          return (
            <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polygon
                points="50,10 90,90 10,90"
                fill={shape.fillColor}
                stroke={shape.strokeColor}
                strokeWidth={shape.strokeWidth}
              />
            </svg>
          );
        case 'star':
          return (
            <svg width="100%" height="100%" viewBox="0 0 100 100">
              <polygon
                points="50,10 61,35 88,35 66,52 74,78 50,62 26,78 34,52 12,35 39,35"
                fill={shape.fillColor}
                stroke={shape.strokeColor}
                strokeWidth={shape.strokeWidth}
              />
            </svg>
          );
        case 'line':
          return (
            <div
              style={{
                width: '100%',
                height: `${shape.strokeWidth}px`,
                backgroundColor: shape.strokeColor
              }}
            />
          );
        default:
          return null;
      }
    };

    return (
      <Resizable
        key={shape.id}
        size={{ width: shape.width, height: shape.height }}
        className={`note-shape ${isSelected ? 'selected' : ''}`}
        style={{
          position: 'absolute',
          left: shape.x,
          top: shape.y,
          zIndex: shape.zIndex || 1
        }}
        onResizeStart={() => {
          setIsResizing(true);
          setIsDragging(false);
        }}
        onResizeStop={(e, direction, ref, d) => {
          setShapes(prevShapes => prevShapes.map(s =>
            s.id === shape.id
              ? { ...s, width: s.width + d.width, height: s.height + d.height }
              : s
          ));
          setIsSaved(false);
          setIsResizing(false);
        }}
        enable={{
          top: true,
          right: true,
          bottom: true,
          left: true,
          topRight: true,
          bottomRight: true,
          bottomLeft: true,
          topLeft: true
        }}
        handleStyles={{
          top: { cursor: 'n-resize' },
          right: { cursor: 'e-resize' },
          bottom: { cursor: 's-resize' },
          left: { cursor: 'w-resize' },
          topRight: { cursor: 'ne-resize' },
          bottomRight: { cursor: 'se-resize' },
          bottomLeft: { cursor: 'sw-resize' },
          topLeft: { cursor: 'nw-resize' }
        }}
      >
        <div
          className="note-shape-content"
          onContextMenu={(e) => {
            // Stop dragging immediately when right-clicking
            stopAllDragging();
            handleContextMenu(e, { type: 'shape', id: shape.id });
          }}
          onMouseDown={(e) => {
            // Don't drag if context menu is open
            if (isContextMenuOpen) {
              return;
            }
            
            // Stop any previous dragging first
            stopAllDragging();
            
            // Don't drag if clicking on resize handle - let Resizable handle it
            if (e.target.closest('.react-resizable-handle')) {
              handleSelectItem({ type: 'shape', id: shape.id });
              return;
            }
            e.stopPropagation();
            handleSelectItem({ type: 'shape', id: shape.id });
            
            const startX = e.clientX;
            const startY = e.clientY;
            const startPosX = shape.x;
            const startPosY = shape.y;
            let hasMoved = false;

            const handleMouseMove = (moveEvent) => {
              // Don't drag if context menu is open
              if (isContextMenuOpen) {
                stopAllDragging();
                return;
              }
              
              if (!hasMoved) {
                setIsDragging(true);
                hasMoved = true;
              }
              moveEvent.preventDefault();
              const deltaX = moveEvent.clientX - startX;
              const deltaY = moveEvent.clientY - startY;
              
              setShapes(prevShapes => prevShapes.map(s =>
                s.id === shape.id
                  ? { ...s, x: startPosX + deltaX, y: startPosY + deltaY }
                  : s
              ));
              setIsSaved(false);
            };

            const handleMouseUp = () => {
              setIsDragging(false);
              if (activeDragHandlersRef.current.mouseMove === handleMouseMove) {
                document.removeEventListener('mousemove', handleMouseMove);
                activeDragHandlersRef.current.mouseMove = null;
              }
              if (activeDragHandlersRef.current.mouseUp === handleMouseUp) {
                document.removeEventListener('mouseup', handleMouseUp);
                activeDragHandlersRef.current.mouseUp = null;
              }
              if (hasMoved) {
                saveVersion('Moved shape');
              }
            };

            // Store handlers in ref
            activeDragHandlersRef.current.mouseMove = handleMouseMove;
            activeDragHandlersRef.current.mouseUp = handleMouseUp;
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
          onTouchStart={(e) => {
            if (e.target.closest('.react-resizable-handle')) return;
            e.stopPropagation();
            setSelectedItem({ type: 'shape', id: shape.id });
            setIsDragging(true);
            
            const touch = e.touches[0];
            const startX = touch.clientX;
            const startY = touch.clientY;
            const startPosX = shape.x;
            const startPosY = shape.y;

            const handleTouchMove = (moveEvent) => {
              moveEvent.preventDefault();
              const touch = moveEvent.touches[0];
              const deltaX = touch.clientX - startX;
              const deltaY = touch.clientY - startY;
              
              setShapes(prevShapes => prevShapes.map(s =>
                s.id === shape.id
                  ? { ...s, x: startPosX + deltaX, y: startPosY + deltaY }
                  : s
              ));
              setIsSaved(false);
            };

            const handleTouchEnd = () => {
              setIsDragging(false);
              document.removeEventListener('touchmove', handleTouchMove);
              document.removeEventListener('touchend', handleTouchEnd);
              saveVersion('Moved shape');
            };

            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.addEventListener('touchend', handleTouchEnd);
          }}
        >
          {shapeContent()}
        </div>
        {isSelected && (
          <>
            <button
              className="note-delete-btn"
              onClick={() => deleteShape(shape.id)}
              style={{ top: '-12px', left: '-12px' }}
            >
              <Trash2 size={16} />
            </button>
            <div 
              className="note-resize-indicator"
              style={{ 
                position: 'absolute', 
                bottom: '-8px', 
                right: '-8px',
                width: '24px',
                height: '24px',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#B593C2',
                borderRadius: '50%',
                border: '2px solid white',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
              }}
            >
              <Maximize2 size={14} color="white" style={{ transform: 'scaleX(-1)' }} />
            </div>
          </>
        )}
      </Resizable>
    );
  };

  return (
    <div className="note-page">
      <div className="note-navbar">
        <button className="note-nav-btn" onClick={() => {
          navigate('/calendar');
        }}>
          <ChevronLeft size={24} />
        </button>

        <div className="note-nav-controls">
          <button 
            className="note-nav-btn" 
            onClick={handleUndo}
            disabled={currentVersionIndex <= 0}
          >
            <Undo2 size={20} />
          </button>
          <button 
            className="note-nav-btn" 
            onClick={handleRedo}
            disabled={currentVersionIndex >= versions.length - 1}
          >
            <Redo2 size={20} />
          </button>

          <div className="note-nav-divider" />

          <button 
            className={`note-nav-btn ${isAddingTextBox ? 'active' : ''}`}
            onClick={() => {
              const newState = !isAddingTextBox;
              setIsAddingTextBox(newState);
              // Close all menus when toggling text box mode
              if (newState) {
                setShowShapesMenu(false);
                setShowStickersMenu(false);
                setShowShareMenu(false);
                setShowColorPicker(false);
              }
            }}
            title="Add text box"
          >
            <Type size={20} />
          </button>

          <div className="note-nav-dropdown">
            <button 
              className="note-nav-btn"
              onClick={() => {
                const newState = !showShapesMenu;
                setShowShapesMenu(newState);
                // Close other menus when opening this menu
                if (newState) {
                  setShowStickersMenu(false);
                  setShowShareMenu(false);
                  setShowColorPicker(false);
                }
              }}
              title="Add shape"
            >
              <Square size={20} />
            </button>
            {showShapesMenu && (
              <div className="note-dropdown-menu">
                <button onClick={(e) => {
                  const clickX = e.clientX;
                  const clickY = e.clientY;
                  addShape('rectangle', clickX, clickY);
                }}><Square size={18} /> Rectangle</button>
                <button onClick={(e) => {
                  const clickX = e.clientX;
                  const clickY = e.clientY;
                  addShape('circle', clickX, clickY);
                }}><Circle size={18} /> Circle</button>
                <button onClick={(e) => {
                  const clickX = e.clientX;
                  const clickY = e.clientY;
                  addShape('triangle', clickX, clickY);
                }}><Triangle size={18} /> Triangle</button>
                <button onClick={(e) => {
                  const clickX = e.clientX;
                  const clickY = e.clientY;
                  addShape('star', clickX, clickY);
                }}><Star size={18} /> Star</button>
                <button onClick={(e) => {
                  const clickX = e.clientX;
                  const clickY = e.clientY;
                  addShape('line', clickX, clickY);
                }}><Minus size={18} /> Line</button>
              </div>
            )}
          </div>

          <div className="note-nav-dropdown">
            <button 
              className="note-nav-btn"
              onClick={() => {
                const newState = !showStickersMenu;
                setShowStickersMenu(newState);
                // Close other menus when opening this menu
                if (newState) {
                  setShowShapesMenu(false);
                  setShowShareMenu(false);
                  setShowColorPicker(false);
                }
              }}
              title="Add sticker"
            >
              <Sticker size={20} />
            </button>
            {showStickersMenu && (
              <div className="note-dropdown-menu note-stickers-menu">
                {STICKERS.map((sticker, index) => (
                  <button key={index} onClick={(e) => {
                    const clickX = e.clientX;
                    const clickY = e.clientY;
                    addSticker(sticker, clickX, clickY);
                  }} className="sticker-btn">
                    <img src={sticker} alt={`Sticker ${index + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <button 
            className="note-nav-btn"
            onClick={() => {
              // Close all menus when clicking image button
              setShowShapesMenu(false);
              setShowStickersMenu(false);
              setShowShareMenu(false);
              setShowColorPicker(false);
              fileInputRef.current?.click();
            }}
            title="Add image"
          >
            <ImageIcon size={20} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            style={{ display: 'none' }}
          />

          {selectedItem?.type === 'shape' && (
            <>
              <div className="note-nav-divider" />
              <div className="note-nav-dropdown">
                <button 
                  className="note-nav-btn"
                  onClick={() => {
                    const newState = !showColorPicker;
                    setShowColorPicker(newState);
                    // Close other menus when opening color picker
                    if (newState) {
                      setShowShareMenu(false);
                      setShowShapesMenu(false);
                      setShowStickersMenu(false);
                    }
                  }}
                  title="Customize shape"
                >
                  <Palette size={20} />
                </button>
                {showColorPicker && getSelectedShape() && (
                  <div className="note-dropdown-menu note-color-menu">
                    <div className="color-control">
                      <label>Fill Color</label>
                      <input
                        type="color"
                        value={getSelectedShape().fillColor === 'transparent' ? '#FFFFFF' : getSelectedShape().fillColor}
                        onChange={(e) => updateShapeColor(selectedItem.id, e.target.value, getSelectedShape().strokeColor)}
                      />
                      <button 
                        className="transparent-btn"
                        onClick={() => updateShapeColor(selectedItem.id, 'transparent', getSelectedShape().strokeColor)}
                      >
                        None
                      </button>
                    </div>
                    <div className="color-control">
                      <label>Stroke Color</label>
                      <input
                        type="color"
                        value={getSelectedShape().strokeColor}
                        onChange={(e) => updateShapeColor(selectedItem.id, getSelectedShape().fillColor, e.target.value)}
                      />
                    </div>
                    <div className="color-control">
                      <label>Stroke Width</label>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={getSelectedShape().strokeWidth}
                        onChange={(e) => updateShapeStroke(selectedItem.id, Number(e.target.value))}
                        style={{ width: '60px', padding: '0.25rem', border: '1px solid #e0e0e0', borderRadius: '4px' }}
                      />
                      <span style={{ fontSize: '0.85rem', color: '#666' }}>px</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="note-nav-divider" />

          <div className="note-nav-dropdown">
            <button 
              className="note-nav-btn"
              onClick={() => {
                const newState = !showShareMenu;
                setShowShareMenu(newState);
                // Close other menus when opening share menu
                if (newState) {
                  setShowColorPicker(false);
                  setShowShapesMenu(false);
                  setShowStickersMenu(false);
                }
              }}
              title="Share"
            >
              <Share2 size={20} />
            </button>
            {showShareMenu && (
              <div className="note-dropdown-menu">
                <button onClick={shareAsLink}><Copy size={16} /> Copy Link</button>
                <button onClick={downloadAsPDF}><Download size={16} /> Download PDF</button>
              </div>
            )}
          </div>

          <button 
            className="note-save-indicator"
            onClick={handleSave}
            title="Save and go to calendar"
          >
            {isSaved ? 'All changes saved' : 'Saving...'}
          </button>
        </div>
      </div>

      {showVersionHistory && (
        <div className="note-version-history">
          <h3>Version History</h3>
          {versions.length === 0 ? (
            <p>No version history yet</p>
          ) : (
            <div className="version-list">
              {versions.map((version, index) => (
                <div 
                  key={version.id} 
                  className={`version-item ${index === currentVersionIndex ? 'current' : ''}`}
                  onClick={() => restoreVersion(index)}
                >
                  <div className="version-description">{version.description}</div>
                  <div className="version-time">
                    {version.timestamp.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div 
        className="note-canvas" 
        ref={canvasRef}
        onContextMenu={handleCanvasContextMenu}
        onClick={(e) => {
          // Close all menus and tag selector when clicking on canvas
          if (e.target === canvasRef.current || e.target.classList.contains('note-content')) {
            setShowTagSelector(false);
            setIsCreatingNewTag(false);
            setShowShapesMenu(false);
            setShowStickersMenu(false);
            setShowShareMenu(false);
            setShowColorPicker(false);
            handleSelectItem(null);
          }
          handleCanvasClick(e);
        }}
        onMouseDown={(e) => {
          // Deselect when clicking directly on canvas
          if (e.target === canvasRef.current || e.target.classList.contains('note-content')) {
            handleSelectItem(null);
          }
        }}
        style={{ cursor: isAddingTextBox ? 'crosshair' : 'default' }}
      >
        <div className="note-header">
          <div className="note-header-left">
            {isEditingTitle ? (
              <input
                className="note-title-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => setIsEditingTitle(false)}
                autoFocus
              />
            ) : (
              <h1 className="note-title" onClick={() => setIsEditingTitle(true)}>
                {title}
              </h1>
            )}

            {isEditingTag ? (
              <input
                className="note-tag-input"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                onBlur={() => {
                  setIsEditingTag(false)
                  updateTagInStorage(tagName, tagColor)
                }}
                autoFocus
              />
            ) : isEditingTagColor ? (
              <div className="note-tag-color-editor">
                <input
                  type="color"
                  value={tagColor}
                  onChange={(e) => {
                    setTagColor(e.target.value)
                    updateTagInStorage(tagName, e.target.value)
                  }}
                  onBlur={() => setIsEditingTagColor(false)}
                  autoFocus
                />
                <button onClick={() => setIsEditingTagColor(false)}>Done</button>
              </div>
            ) : showTagSelector ? (
              <div className="note-tag-selector" onClick={(e) => e.stopPropagation()}>
                <div className="tag-selector-header">
                  <button className="back-btn" onClick={(e) => {
                    e.stopPropagation();
                    setShowTagSelector(false);
                    setIsCreatingNewTag(false);
                  }}>←</button>
                  <h4>Select Tag</h4>
                </div>
                {!isCreatingNewTag ? (
                  <>
                    <div className="tag-list">
                      {getTags().map(tag => (
                        <div
                          key={tag.id}
                          className="tag-option"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectTag(tag);
                          }}
                          style={{ backgroundColor: tag.color }}
                        >
                          {tag.name}
                        </div>
                      ))}
                    </div>
                    <button 
                      className="create-tag-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsCreatingNewTag(true);
                      }}
                    >
                      + Create New Tag
                    </button>
                  </>
                ) : (
                  <div className="create-tag-form">
                    <input
                      type="text"
                      placeholder="Tag name"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newTagName.trim()) {
                          createNewTag();
                        }
                      }}
                      style={{ marginBottom: '0.5rem', padding: '0.5rem', border: '1px solid #e0e0e0', borderRadius: '4px' }}
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <input
                        type="color"
                        value={newTagColor}
                        onChange={(e) => setNewTagColor(e.target.value)}
                        style={{ width: '40px', height: '40px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.85rem', color: '#666' }}>Color</span>
                    </div>
                    <button 
                      className="save-tag-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        createNewTag();
                      }}
                      disabled={!newTagName.trim()}
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div 
                className="note-tag" 
                style={{ backgroundColor: tagColor }}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingTag(true);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setShowTagSelector(true);
                }}
                title="Click to edit name, double-click to select tag"
              >
                {tagName}
              </div>
            )}
          </div>
        </div>

        <div className="note-content">
          {[...textBoxes, ...shapes.map(s => ({ ...s, elementType: 'shape' })), ...images.map(i => ({ ...i, elementType: 'image' })), ...stickers.map(s => ({ ...s, elementType: 'sticker' }))]
            .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
            .map((element) => {
              if (element.elementType === 'shape') {
                const shape = element;
                const isSelected = selectedItem?.type === 'shape' && selectedItem.id === shape.id;
                return renderShape(shape, isSelected);
              } else if (element.elementType === 'image') {
                const image = element;
                const isSelected = selectedItem?.type === 'image' && selectedItem.id === image.id;
                return (
                  <Resizable
                    key={image.id}
                    size={{ width: image.width, height: image.height }}
                    onResizeStart={() => {
                      setIsResizing(true);
                      setIsDragging(false);
                    }}
                    onResizeStop={(e, direction, ref, d) => {
                      setImages(prevImages => prevImages.map(img =>
                        img.id === image.id
                          ? { ...img, width: img.width + d.width, height: img.height + d.height }
                          : img
                      ));
                      setIsSaved(false);
                      setIsResizing(false);
                    }}
                    className={`note-image-wrapper ${isSelected ? 'selected' : ''}`}
                    style={{
                      position: 'absolute',
                      left: image.x,
                      top: image.y,
                      zIndex: image.zIndex || 1
                    }}
                    enable={{
                      top: true,
                      right: true,
                      bottom: true,
                      left: true,
                      topRight: true,
                      bottomRight: true,
                      bottomLeft: true,
                      topLeft: true
                    }}
                    handleStyles={{
                      top: { cursor: 'n-resize' },
                      right: { cursor: 'e-resize' },
                      bottom: { cursor: 's-resize' },
                      left: { cursor: 'w-resize' },
                      topRight: { cursor: 'ne-resize' },
                      bottomRight: { cursor: 'se-resize' },
                      bottomLeft: { cursor: 'sw-resize' },
                      topLeft: { cursor: 'nw-resize' }
                    }}
                  >
                    <div
                      className="note-image-container"
                      onContextMenu={(e) => {
                        // Stop dragging immediately when right-clicking
                        stopAllDragging();
                        handleContextMenu(e, { type: 'image', id: image.id });
                      }}
                      onMouseDown={(e) => {
                        // Don't drag if context menu is open
                        if (isContextMenuOpen) {
                          return;
                        }
                        
                        // Stop any previous dragging first
                        stopAllDragging();
                        
                        // Don't drag if clicking on resize handle - let Resizable handle it
                        if (e.target.closest('.react-resizable-handle')) {
                          handleSelectItem({ type: 'image', id: image.id });
                          return;
                        }
                        
                        // Don't drag if clicking on delete button
                        if (e.target.closest('.note-delete-btn')) {
                          return;
                        }
                        
                        e.stopPropagation();
                        handleSelectItem({ type: 'image', id: image.id });
                        
                        const startX = e.clientX;
                        const startY = e.clientY;
                        const startPosX = image.x;
                        const startPosY = image.y;
                        let hasMoved = false;

                        const handleMouseMove = (moveEvent) => {
                          // Don't drag if context menu is open
                          if (isContextMenuOpen) {
                            stopAllDragging();
                            return;
                          }
                          
                          if (!hasMoved) {
                            setIsDragging(true);
                            hasMoved = true;
                          }
                          moveEvent.preventDefault();
                          const deltaX = moveEvent.clientX - startX;
                          const deltaY = moveEvent.clientY - startY;
                          
                          setImages(prevImages => prevImages.map(img =>
                            img.id === image.id
                              ? { ...img, x: startPosX + deltaX, y: startPosY + deltaY }
                              : img
                          ));
                          setIsSaved(false);
                        };

                        const handleMouseUp = () => {
                          setIsDragging(false);
                          if (activeDragHandlersRef.current.mouseMove === handleMouseMove) {
                            document.removeEventListener('mousemove', handleMouseMove);
                            activeDragHandlersRef.current.mouseMove = null;
                          }
                          if (activeDragHandlersRef.current.mouseUp === handleMouseUp) {
                            document.removeEventListener('mouseup', handleMouseUp);
                            activeDragHandlersRef.current.mouseUp = null;
                          }
                          if (hasMoved) {
                            saveVersion('Moved image');
                          }
                        };

                        // Store handlers in ref
                        activeDragHandlersRef.current.mouseMove = handleMouseMove;
                        activeDragHandlersRef.current.mouseUp = handleMouseUp;
                        
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      }}
                    >
                      <img
                        src={image.src}
                        alt="Uploaded"
                        className="note-image"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          transform: `rotate(${image.rotation}deg)`,
                          pointerEvents: 'none'
                        }}
                      />
                    </div>
                    {isSelected && (
                      <>
                        <button
                          className="note-delete-btn"
                          onClick={() => deleteImage(image.id)}
                          style={{ top: '-12px', left: '-12px' }}
                        >
                          <Trash2 size={16} />
                        </button>
                        <div 
                          className="note-resize-indicator"
                          style={{ 
                            position: 'absolute', 
                            bottom: '-8px', 
                            right: '-8px',
                            width: '24px',
                            height: '24px',
                            pointerEvents: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#B593C2',
                            borderRadius: '50%',
                            border: '2px solid white',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                          }}
                        >
                          <Maximize2 size={14} color="white" style={{ transform: 'scaleX(-1)' }} />
                        </div>
                      </>
                    )}
                  </Resizable>
                );
              } else if (element.elementType === 'sticker') {
                const sticker = element;
                const isSelected = selectedItem?.type === 'sticker' && selectedItem.id === sticker.id;
                return (
                  <Resizable
                    key={sticker.id}
                    size={{ width: sticker.width, height: sticker.height }}
                    onResizeStart={() => {
                      setIsResizing(true);
                      setIsDragging(false);
                    }}
                    onResizeStop={(e, direction, ref, d) => {
                      setStickers(prevStickers => prevStickers.map(s =>
                        s.id === sticker.id
                          ? { ...s, width: s.width + d.width, height: s.height + d.height }
                          : s
                      ));
                      setIsSaved(false);
                      setIsResizing(false);
                    }}
                    className={`note-sticker-wrapper ${isSelected ? 'selected' : ''}`}
                    style={{
                      position: 'absolute',
                      left: sticker.x,
                      top: sticker.y,
                      zIndex: sticker.zIndex || 1
                    }}
                    enable={{
                      top: true,
                      right: true,
                      bottom: true,
                      left: true,
                      topRight: true,
                      bottomRight: true,
                      bottomLeft: true,
                      topLeft: true
                    }}
                    handleStyles={{
                      top: { cursor: 'n-resize' },
                      right: { cursor: 'e-resize' },
                      bottom: { cursor: 's-resize' },
                      left: { cursor: 'w-resize' },
                      topRight: { cursor: 'ne-resize' },
                      bottomRight: { cursor: 'se-resize' },
                      bottomLeft: { cursor: 'sw-resize' },
                      topLeft: { cursor: 'nw-resize' }
                    }}
                  >
                    <div
                      className="note-sticker-container"
                      onContextMenu={(e) => {
                        // Stop dragging immediately when right-clicking
                        stopAllDragging();
                        handleContextMenu(e, { type: 'sticker', id: sticker.id });
                      }}
                      onMouseDown={(e) => {
                        // Don't drag if context menu is open
                        if (isContextMenuOpen) {
                          return;
                        }
                        
                        // Stop any previous dragging first
                        stopAllDragging();
                        
                        // Don't drag if clicking on resize handle - let Resizable handle it
                        if (e.target.closest('.react-resizable-handle')) {
                          handleSelectItem({ type: 'sticker', id: sticker.id });
                          return;
                        }
                        
                        // Don't drag if clicking on delete button
                        if (e.target.closest('.note-delete-btn')) {
                          return;
                        }
                        
                        e.stopPropagation();
                        e.preventDefault();
                        handleSelectItem({ type: 'sticker', id: sticker.id });
                        
                        const startX = e.clientX;
                        const startY = e.clientY;
                        const startPosX = sticker.x;
                        const startPosY = sticker.y;
                        let hasMoved = false;

                        const handleMouseMove = (moveEvent) => {
                          // Don't drag if context menu is open
                          if (isContextMenuOpen) {
                            stopAllDragging();
                            return;
                          }
                          
                          if (!hasMoved) {
                            setIsDragging(true);
                            hasMoved = true;
                          }
                          moveEvent.preventDefault();
                          const deltaX = moveEvent.clientX - startX;
                          const deltaY = moveEvent.clientY - startY;
                          
                          setStickers(prevStickers => prevStickers.map(s =>
                            s.id === sticker.id
                              ? { ...s, x: startPosX + deltaX, y: startPosY + deltaY }
                              : s
                          ));
                          setIsSaved(false);
                        };

                        const handleMouseUp = () => {
                          setIsDragging(false);
                          if (activeDragHandlersRef.current.mouseMove === handleMouseMove) {
                            document.removeEventListener('mousemove', handleMouseMove);
                            activeDragHandlersRef.current.mouseMove = null;
                          }
                          if (activeDragHandlersRef.current.mouseUp === handleMouseUp) {
                            document.removeEventListener('mouseup', handleMouseUp);
                            activeDragHandlersRef.current.mouseUp = null;
                          }
                          if (hasMoved) {
                            saveVersion('Moved sticker');
                          }
                        };

                        // Store handlers in ref
                        activeDragHandlersRef.current.mouseMove = handleMouseMove;
                        activeDragHandlersRef.current.mouseUp = handleMouseUp;
                        
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      }}
                    >
                      <img
                        src={sticker.src}
                        alt="Sticker"
                        className="note-sticker"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          transform: `rotate(${sticker.rotation}deg)`,
                          pointerEvents: 'none'
                        }}
                      />
                    </div>
                    {isSelected && (
                      <>
                        <button
                          className="note-delete-btn"
                          onClick={() => deleteSticker(sticker.id)}
                          style={{ top: '-12px', left: '-12px' }}
                        >
                          <Trash2 size={16} />
                        </button>
                        <div 
                          className="note-resize-indicator"
                          style={{ 
                            position: 'absolute', 
                            bottom: '-8px', 
                            right: '-8px',
                            width: '24px',
                            height: '24px',
                            pointerEvents: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#B593C2',
                            borderRadius: '50%',
                            border: '2px solid white',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                          }}
                        >
                          <Maximize2 size={14} color="white" style={{ transform: 'scaleX(-1)' }} />
                        </div>
                      </>
                    )}
                  </Resizable>
                );
              }
              
              // textbox
              const textBox = element;
              const isSelected = selectedItem?.type === 'textbox' && selectedItem.id === textBox.id;
              return (
              <Resizable
                key={textBox.id}
                size={{ width: textBox.width, height: textBox.height }}
                onResizeStart={() => {
                  setIsResizing(true);
                  setIsDragging(false);
                }}
                onResizeStop={(e, direction, ref, d) => {
                  setTextBoxes(prevTextBoxes => prevTextBoxes.map(tb =>
                    tb.id === textBox.id
                      ? { ...tb, width: tb.width + d.width, height: tb.height + d.height }
                      : tb
                  ));
                  setIsSaved(false);
                  setIsResizing(false);
                }}
                className={`note-textbox-wrapper ${isSelected ? 'selected' : ''}`}
                style={{
                  position: 'absolute',
                  left: textBox.x,
                  top: textBox.y,
                  zIndex: textBox.zIndex || 1
                }}
                enable={{
                  top: true,
                  right: true,
                  bottom: true,
                  left: true,
                  topRight: true,
                  bottomRight: true,
                  bottomLeft: true,
                  topLeft: true
                }}
                handleStyles={{
                  top: { cursor: 'n-resize' },
                  right: { cursor: 'e-resize' },
                  bottom: { cursor: 's-resize' },
                  left: { cursor: 'w-resize' },
                  topRight: { cursor: 'ne-resize' },
                  bottomRight: { cursor: 'se-resize' },
                  bottomLeft: { cursor: 'sw-resize' },
                  topLeft: { cursor: 'nw-resize' }
                }}
              >
                <div
                  className="note-textbox-container"
                  style={{ position: 'relative' }}
                  onContextMenu={(e) => {
                    // Stop dragging immediately when right-clicking
                    stopAllDragging();
                    handleContextMenu(e, { type: 'textbox', id: textBox.id });
                  }}
                  onMouseDown={(e) => {
                    // Check if right mouse button (button === 2)
                    if (e.button === 2) {
                      isRightClickRef.current = true;
                      stopAllDragging();
                      return;
                    }
                    
                    // Don't drag if context menu is open
                    if (isContextMenuOpen) {
                      return;
                    }
                    
                    // Stop any previous dragging first
                    stopAllDragging();
                    isRightClickRef.current = false;
                    
                    // Don't drag if clicking on textarea - handle separately
                    if (e.target.tagName === 'TEXTAREA') {
                      // Single click - just select, don't drag yet
                      handleSelectItem({ type: 'textbox', id: textBox.id });
                      return;
                    }
                    
                    // Don't drag if clicking on resize handle - let Resizable handle it
                    if (e.target.closest('.react-resizable-handle')) {
                      handleSelectItem({ type: 'textbox', id: textBox.id });
                      return;
                    }
                    
                    // Don't drag if clicking on delete button
                    if (e.target.closest('.note-delete-btn')) {
                      return;
                    }
                    
                    e.stopPropagation();
                    e.preventDefault();
                    handleSelectItem({ type: 'textbox', id: textBox.id });
                    
                    const startX = e.clientX;
                    const startY = e.clientY;
                    const startPosX = textBox.x;
                    const startPosY = textBox.y;
                    let hasMoved = false;

                    const mouseMoveHandler = (moveEvent) => {
                      // Don't drag if context menu is open or right click detected
                      if (isContextMenuOpen || isRightClickRef.current) {
                        stopAllDragging();
                        return;
                      }
                      
                      if (!hasMoved) {
                        setIsDragging(true);
                        hasMoved = true;
                      }
                      moveEvent.preventDefault();
                      const deltaX = moveEvent.clientX - startX;
                      const deltaY = moveEvent.clientY - startY;
                      
                      setTextBoxes(prevTextBoxes => prevTextBoxes.map(tb =>
                        tb.id === textBox.id
                          ? { ...tb, x: startPosX + deltaX, y: startPosY + deltaY }
                          : tb
                      ));
                      setIsSaved(false);
                    };

                    const mouseUpHandler = () => {
                      setIsDragging(false);
                      if (activeDragHandlersRef.current.mouseMove === mouseMoveHandler) {
                        document.removeEventListener('mousemove', mouseMoveHandler);
                        activeDragHandlersRef.current.mouseMove = null;
                      }
                      if (activeDragHandlersRef.current.mouseUp === mouseUpHandler) {
                        document.removeEventListener('mouseup', mouseUpHandler);
                        activeDragHandlersRef.current.mouseUp = null;
                      }
                      if (activeDragHandlersRef.current.contextMenu === contextMenuHandler) {
                        document.removeEventListener('contextmenu', contextMenuHandler);
                        activeDragHandlersRef.current.contextMenu = null;
                      }
                      if (hasMoved && !isRightClickRef.current) {
                        saveVersion('Moved text box');
                      }
                      isRightClickRef.current = false;
                    };

                    const contextMenuHandler = () => {
                      isRightClickRef.current = true;
                      stopAllDragging();
                    };

                    // Store handlers in ref BEFORE adding listeners
                    activeDragHandlersRef.current.mouseMove = mouseMoveHandler;
                    activeDragHandlersRef.current.mouseUp = mouseUpHandler;
                    activeDragHandlersRef.current.contextMenu = contextMenuHandler;
                    
                    document.addEventListener('mousemove', mouseMoveHandler);
                    document.addEventListener('mouseup', mouseUpHandler);
                    document.addEventListener('contextmenu', contextMenuHandler, { once: true });
                  }}
                  onDoubleClick={(e) => {
                    // Double click on container - focus textarea for editing
                    if (e.target.tagName !== 'TEXTAREA') {
                      const textarea = e.currentTarget.querySelector('textarea');
                      if (textarea) {
                        textarea.focus();
                        textarea.select();
                      }
                    }
                  }}
                  onTouchStart={(e) => {
                    if (e.target.tagName === 'TEXTAREA' || e.target.closest('.react-resizable-handle')) return;
                    
                    e.stopPropagation();
                    handleSelectItem({ type: 'textbox', id: textBox.id });
                    
                    const touch = e.touches[0];
                    const startX = touch.clientX;
                    const startY = touch.clientY;
                    const startPosX = textBox.x;
                    const startPosY = textBox.y;
                    let hasMoved = false;

                    const handleTouchMove = (moveEvent) => {
                      if (!hasMoved) {
                        setIsDragging(true);
                        hasMoved = true;
                      }
                      moveEvent.preventDefault();
                      const touch = moveEvent.touches[0];
                      const deltaX = touch.clientX - startX;
                      const deltaY = touch.clientY - startY;
                      
                      setTextBoxes(prevTextBoxes => prevTextBoxes.map(tb =>
                        tb.id === textBox.id
                          ? { ...tb, x: startPosX + deltaX, y: startPosY + deltaY }
                          : tb
                      ));
                      setIsSaved(false);
                    };

                    const handleTouchEnd = () => {
                      setIsDragging(false);
                      document.removeEventListener('touchmove', handleTouchMove);
                      document.removeEventListener('touchend', handleTouchEnd);
                      if (hasMoved) {
                        saveVersion('Moved text box');
                      }
                    };

                    document.addEventListener('touchmove', handleTouchMove, { passive: false });
                    document.addEventListener('touchend', handleTouchEnd);
                  }}
                >
                  <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                    <textarea
                      className="note-textbox"
                      value={textBox.content}
                      onChange={(e) => {
                        setTextBoxes(textBoxes.map(tb => 
                          tb.id === textBox.id ? { ...tb, content: e.target.value } : tb
                        ));
                        setIsSaved(false);
                      }}
                      onFocus={() => handleSelectItem({ type: 'textbox', id: textBox.id })}
                      onBlur={() => saveVersion('Updated text')}
                      onMouseDown={(e) => {
                        // Check if right mouse button (button === 2)
                        if (e.button === 2) {
                          isRightClickRef.current = true;
                          stopAllDragging();
                          return;
                        }
                        
                        // Single click - select the textbox
                        handleSelectItem({ type: 'textbox', id: textBox.id });
                        
                        // Stop any previous dragging first
                        stopAllDragging();
                        isRightClickRef.current = false;
                        
                        // Don't prevent default immediately - allow text selection
                        // But track if user wants to drag
                        const startX = e.clientX;
                        const startY = e.clientY;
                        const startPosX = textBox.x;
                        const startPosY = textBox.y;
                        let hasMoved = false;
                        let isDragging = false;

                        const handleMouseMove = (moveEvent) => {
                          // Don't drag if right click detected
                          if (isRightClickRef.current || isContextMenuOpen) {
                            stopAllDragging();
                            return;
                          }
                          
                          const deltaX = Math.abs(moveEvent.clientX - startX);
                          const deltaY = Math.abs(moveEvent.clientY - startY);
                          
                          // Only start dragging if mouse moved more than 5px
                          if ((deltaX > 5 || deltaY > 5) && !isDragging) {
                            isDragging = true;
                            hasMoved = true;
                            setIsDragging(true);
                            // Blur textarea to stop text selection
                            e.target.blur();
                            // Prevent default to stop text selection
                            moveEvent.preventDefault();
                          }
                          
                          if (isDragging) {
                            moveEvent.preventDefault();
                            const finalDeltaX = moveEvent.clientX - startX;
                            const finalDeltaY = moveEvent.clientY - startY;
                            
                            setTextBoxes(prevTextBoxes => prevTextBoxes.map(tb =>
                              tb.id === textBox.id
                                ? { ...tb, x: startPosX + finalDeltaX, y: startPosY + finalDeltaY }
                                : tb
                            ));
                            setIsSaved(false);
                          }
                        };

                        const handleMouseUp = () => {
                          setIsDragging(false);
                          document.removeEventListener('mousemove', handleMouseMove);
                          document.removeEventListener('mouseup', handleMouseUp);
                          if (hasMoved && !isRightClickRef.current) {
                            saveVersion('Moved text box');
                          }
                          isRightClickRef.current = false;
                        };

                        const contextMenuHandler = () => {
                          isRightClickRef.current = true;
                          stopAllDragging();
                        };

                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                        document.addEventListener('contextmenu', contextMenuHandler, { once: true });
                      }}
                      onContextMenu={(e) => {
                        e.stopPropagation();
                        isRightClickRef.current = true;
                        stopAllDragging();
                        handleContextMenu(e, { type: 'textbox', id: textBox.id });
                      }}
                      onDoubleClick={(e) => {
                        // Double click - focus and select text for editing
                        e.stopPropagation();
                        e.target.focus();
                        e.target.select();
                      }}
                      placeholder="Type here..."
                      style={{ width: '100%', height: '100%' }}
                    />
                    {isSelected && (
                      <>
                        <button
                          className="note-delete-btn"
                          onClick={() => deleteTextBox(textBox.id)}
                          style={{ top: '-12px', left: '-12px' }}
                        >
                          <Trash2 size={16} />
                        </button>
                        <div 
                          className="note-resize-indicator"
                          style={{ 
                            position: 'absolute', 
                            bottom: '-8px', 
                            right: '-8px',
                            width: '24px',
                            height: '24px',
                            pointerEvents: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#B593C2',
                            borderRadius: '50%',
                            border: '2px solid white',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                          }}
                        >
                          <Maximize2 size={14} color="white" style={{ transform: 'scaleX(-1)' }} />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </Resizable>
            );
          })}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="note-context-menu"
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 10000
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {contextMenu.item ? (
            <>
              <button onClick={() => { copyItem(); closeContextMenu(); }}>
                <Copy size={16} /> Copy
              </button>
              <button onClick={() => { cutItem(); closeContextMenu(); }}>
                <Scissors size={16} /> Cut
              </button>
              {clipboard && (
                <button onClick={() => { pasteItem(); closeContextMenu(); }}>
                  Paste
                </button>
              )}
              <button onClick={() => { duplicateItem(); closeContextMenu(); }}>
                Duplicate
              </button>
              <div className="context-menu-divider" />
              <button onClick={() => { bringToFront(); }}>
                <ArrowUp size={16} /> Bring to Front
              </button>
              <button onClick={() => { sendToBack(); }}>
                <ArrowDown size={16} /> Send to Back
              </button>
              <div className="context-menu-divider" />
              <button onClick={() => {
                if (contextMenu.item.type === 'textbox') {
                  deleteTextBox(contextMenu.item.id);
                } else if (contextMenu.item.type === 'shape') {
                  deleteShape(contextMenu.item.id);
                } else if (contextMenu.item.type === 'image') {
                  deleteImage(contextMenu.item.id);
                } else if (contextMenu.item.type === 'sticker') {
                  deleteSticker(contextMenu.item.id);
                }
                closeContextMenu();
              }}>
                <Trash2 size={16} /> Delete
              </button>
            </>
          ) : (
            <>
              {clipboard && (
                <button onClick={() => { pasteItem(); closeContextMenu(); }}>
                  <Copy size={16} /> Paste
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default Note
