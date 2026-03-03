/* eslint-disable react/prop-types */
import { useState } from "react";
import { 
  FormControlLabel, 
  FormGroup, 
  FormLabel, 
  Checkbox 
} from "@mui/material";

interface LanguageSelectionProps {
  onEnglishChange: (value: string) => void;
  onSpanishChange: (value: string) => void;
}

export const LanguageSelection: React.FC<LanguageSelectionProps> = ({ 
  onEnglishChange, 
  onSpanishChange 
}) => {
  const [isEnglishChecked, setIsEnglishChecked] = useState(true);
  const [isSpanishChecked, setIsSpanishChecked] = useState(false);

  const handleEnglishChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    setIsEnglishChecked(checked);
    onEnglishChange(checked.toString());
  };

  const handleSpanishChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    setIsSpanishChecked(checked);
    onSpanishChange(checked.toString());
  };

  // Balanced Spacing: Reduces padding without squeezing the rows together with negative margins
  const balancedCheckboxStyle = {
    padding: '4px', // Standard MUI is 9px; 4px is a comfortable middle ground
  };

  return (
    <FormGroup>
      <FormLabel 
        component="legend" 
        sx={{ 
          color: 'primary.main', 
          mb: 1 // Keeps a clear gap between the title and the first option
        }}
      >
        Language
      </FormLabel>
      
      <FormControlLabel 
        control={
          <Checkbox 
            checked={isEnglishChecked} 
            onChange={handleEnglishChange} 
            sx={balancedCheckboxStyle} 
          />
        } 
        label="English" 
        sx={{ mb: 0.5 }} // A tiny bit of breathing room between items
      />
      
      <FormControlLabel 
        control={
          <Checkbox 
            checked={isSpanishChecked} 
            onChange={handleSpanishChange} 
            sx={balancedCheckboxStyle} 
          />
        } 
        label="Spanish" 
      />
    </FormGroup>
  );
};