import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type ResultsTab = "seller" | "products";

interface UiState {
  /** The job currently shown in the dashboard — server data for it lives in React Query, not here. */
  selectedJobId: string | null;
  activeTab: ResultsTab;
}

const initialState: UiState = {
  selectedJobId: null,
  activeTab: "seller",
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    selectJob(state, action: PayloadAction<string>) {
      state.selectedJobId = action.payload;
      state.activeTab = "seller";
    },
    setActiveTab(state, action: PayloadAction<ResultsTab>) {
      state.activeTab = action.payload;
    },
  },
});

export const { selectJob, setActiveTab } = uiSlice.actions;
export default uiSlice.reducer;
