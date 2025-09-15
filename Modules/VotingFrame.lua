--@debug@
if LibDebug then LibDebug() end
--@end-debug@

local addon = LibStub("AceAddon-3.0"):GetAddon("RCLootCouncil_Classic")
local RCPreLoot = addon:GetModule("RCPreLoot")
local RCPLImporter = RCPreLoot:GetModule("RCPLImporter")
local RCVotingFrame = addon:GetModule("RCVotingFrame")
local RCPLVotingFrame = RCPreLoot:NewModule("RCPLVotingFrame", "AceComm-3.0", "AceConsole-3.0", "AceHook-3.0", "AceEvent-3.0", "AceTimer-3.0", "AceSerializer-3.0")

local session = 1

function RCPLVotingFrame:OnInitialize()
	if not RCVotingFrame.scrollCols then -- RCVotingFrame hasn't been initialized.
		return self:ScheduleTimer("OnInitialize", 0.5)
	end
    self:UpdateColumns()

	self.initialize = true
end

function RCPLVotingFrame:GetScrollColIndexFromName(colName)
    for i, v in ipairs(RCVotingFrame.scrollCols) do
        if v.colName == colName then
            return i
        end
    end
end

function RCPLVotingFrame:UpdateColumns()
    local ratio =
    { name = "Ratio", DoCellUpdate = self.SetCellRatio, colName = "ratio", sortnext = self:GetScrollColIndexFromName("response"), width = 60, align = "CENTER", defaultsort = "dsc" }
    
    RCPreLoot:ReinsertColumnAtTheEnd(RCVotingFrame.scrollCols, ratio)
    self:ResponseSortPRNext()
    RCPreLoot.DebugPrint("Updated columns")

    if RCVotingFrame:GetFrame() then
        RCVotingFrame:GetFrame().UpdateSt()
    end
end

function RCPLVotingFrame:ResponseSortPRNext()
    local responseIdx = self:GetScrollColIndexFromName("response")
    local prIdx = self:GetScrollColIndexFromName("pr")
    if responseIdx then
        RCVotingFrame.scrollCols[responseIdx].sortnext = prIdx
    end
end

local COLOR_GREY = "|cFF808080"
local COLOR_GREEN = "|cFF2bf20c"
local COLOR_YELLOW = "|cFFFFFF00"
local COLOR_ORANGE = "|cFFFFA500"
local COLOR_RED = "|cFFFF0000"


function RCPLVotingFrame.SetCellRatio(rowFrame, frame, data, cols, row, realrow, column, fShow, table, ...)
    local playerName = data[realrow].name
    local playerNameShort = addon.Ambiguate(playerName, "short")
    RCPreLoot.DebugPrint("Getting ratio for "..tostring(playerNameShort))

    local ratios = RCPLImporter:GetRatios()
    local playerRatio = nil
    for name, ratio in pairs(ratios) do
        if name == playerNameShort then
            RCPreLoot.DebugPrint(name .. " has ratio: " .. tostring(ratio))
            playerRatio = ratio
            break
        end
    end

    if not playerRatio then
        frame.text:SetText(COLOR_RED.."?")
    elseif playerRatio >= 75 then
        frame.text:SetText(COLOR_GREEN..playerRatio)
    elseif playerRatio < 75 and playerRatio >= 50 then
        frame.text:SetText(COLOR_YELLOW..playerRatio)
    elseif playerRatio < 50 and playerRatio >= 25 then
        frame.text:SetText(COLOR_ORANGE..playerRatio)
    elseif playerRatio < 25 then
        frame.text:SetText(COLOR_RED..playerRatio)
    else
        frame.text:SetText(COLOR_GREY..playerRatio)
    end
    data[realrow].cols[column].value = playerRatio or -1
end

----------------------------------------------------------------
-- function RCPLVotingFrame:AddWidgetsIntoVotingFrame()
--     local f = RCVotingFrame:GetFrame()

--     if not f.gpString then
--         local gpstr = f.content:CreateFontString(nil, "OVERLAY", "GameFontNormal")
--         gpstr:SetPoint("CENTER", f.content, "TOPLEFT", 300, - 60)
--         gpstr:SetText("Ratio: ")
--         gpstr:Show()
--         gpstr:SetTextColor(1, 1, 0, 1) -- Yellow
--         f.gpString = gpstr
--     end


--     local editbox_name = "RCLootCouncil_PreLoot_EditBox"
--     if not f.gpEditbox then
--         local editbox = _G.CreateFrame("EditBox", editbox_name, f.content, "AutoCompleteEditBoxTemplate")
--         editbox:SetWidth(40)
--         editbox:SetHeight(32)
--         editbox:SetFontObject("ChatFontNormal")
--         editbox:SetNumeric(true)
--         editbox:SetMaxLetters(5)
--         editbox:SetAutoFocus(false)

--         local left = editbox:CreateTexture(("%sLeft"):format(editbox_name), "BACKGROUND")
--         left:SetTexture([[Interface\ChatFrame\UI-ChatInputBorder-Left2]])
--         left:SetWidth(8)
--         left:SetHeight(32)
--         left:SetPoint("LEFT", -5, 0)

--         local right = editbox:CreateTexture(("%sRight"):format(editbox_name), "BACKGROUND")
--         right:SetTexture([[Interface\ChatFrame\UI-ChatInputBorder-Right2]])
--         right:SetWidth(8)
--         right:SetHeight(32)
--         right:SetPoint("RIGHT", 5, 0)

--         local mid = editbox:CreateTexture(("%sMid"):format(editbox_name), "BACKGROUND")
--         mid:SetTexture([[Interface\ChatFrame\UI-ChatInputBorder-Mid2]])
--         mid:SetHeight(32)
--         mid:SetPoint("TOPLEFT", left, "TOPRIGHT", 0, 0)
--         mid:SetPoint("TOPRIGHT", right, "TOPLEFT", 0, 0)

--         --local label = editbox:CreateFontString(editbox_name, "ARTWORK", "GameFontNormalSmall")
--         --label:SetPoint("RIGHT", editbox, "LEFT", - 15, 0)
--         --label:Show()
--         editbox.left = left
--         editbox.right = right
--         editbox.mid = mid
--         --editbox.label = label

--         editbox:SetPoint("LEFT", f.gpString, "RIGHT", 10, 0)
--         editbox:Show()

--         -- -- Auto release Focus after 3s editbox is not used
--         -- local loseFocusTime = 3
--         -- editbox:SetScript("OnEditFocusGained", function(self, userInput) self.lastUsedTime = GetTime() end)
--         -- editbox:SetScript("OnTextChanged", function(self, userInput)
--         --     self.lastUsedTime = GetTime()
--         --     RCEPGP:RefreshMenu(1)
--         --  end)
--         -- editbox:SetScript("OnUpdate", function(self, elapsed)
--         --     if self.lastUsedTime and GetTime() - self.lastUsedTime > loseFocusTime then
--         --         self.lastUsedTime = nil
--         --         if editbox:HasFocus() then
--         --             editbox:ClearFocus()
--         --         end
--         --     end
--         --     if addon.isMasterLooter then -- Cant enter text if not master looter.
--         --         self:Enable()
--         --     else
--         --         self:Disable()
--         --     end
--         -- end)

--         -- -- Clear focus when rightclick menu opens.
-- 		--   if _G["MSA_DropDownList1"] then
-- 	    --     if not self:IsHooked(_G["MSA_DropDownList1"], "OnShow") then
-- 	    --         self:SecureHookScript(_G["MSA_DropDownList1"], "OnShow", function()
-- 	    --             if f and f.gpEditbox then
-- 	    --                 f.gpEditbox:ClearFocus()
-- 	    --             end
-- 	    --         end)
-- 	    --     end
-- 		--   end
--         -- f.gpEditbox = editbox
--     end
-- end