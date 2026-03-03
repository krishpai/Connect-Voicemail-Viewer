import React from "react";
import {
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  Box
} from "@mui/material";

interface VMCategoryProps {
  region: string;
  vmCategory: string;
  onVMCategoryChange: (value: string) => void;
}

export const VMCategory: React.FC<VMCategoryProps> = ({ 
  region, 
  vmCategory, 
  onVMCategoryChange 
}) => {
  const isGlobal = region === "ALL";

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onVMCategoryChange(event.target.value);
  };

  const globalOptions = [
    { value: "SFL", label: "SFL" },
    { value: "NFL", label: "NFL" },
    { value: "GA", label: "GA" },
    { value: "CA", label: "CA" },
    { value: "ALL", label: "ALL" },
    { value: "Self", label: "My own" },
  ];

  // Increased padding slightly from 0.25 to 0.5 for a "middle ground" feel
  const BalancedRadio = <Radio sx={{ py: 0.5 }} />;

  return (
    <FormControl component="fieldset">
      <FormLabel 
        component="legend" 
        sx={{ 
          color: 'primary.main', 
          width: '100%', 
          textAlign: 'left', 
          mb: 1, 
          display: 'block', 
          marginLeft: 14 
        }}
      >
        Mailbox
      </FormLabel>
      
      <RadioGroup 
        value={vmCategory} 
        onChange={handleChange} 
        name="vm-category-radio-buttons-group"
        sx={{ ml: 6 }} 
      >
        {isGlobal ? (
          <Box 
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              rowGap: 0.5,     // Increased from 0 to 0.5 for a small gap
              columnGap: 2,   // Increased horizontal gap for better readability
            }}
          >
            {globalOptions.map((option) => (
              <FormControlLabel 
                key={option.value}
                value={option.value} 
                control={BalancedRadio} 
                label={option.label} 
                sx={{ my: 0 }} // Removed negative margin to let them breathe
              />
            ))}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <FormControlLabel 
                value={region} 
                control={BalancedRadio} 
                label={region} 
            />
            <FormControlLabel 
                value="Self" 
                control={BalancedRadio} 
                label="My own" 
            />
          </Box>
        )}
      </RadioGroup>
    </FormControl>
  );
};