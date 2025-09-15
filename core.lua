local GetAddOnMetadata = C_AddOns.GetAddOnMetadata
---@type RCLootCouncil
local addon = LibStub("AceAddon-3.0"):GetAddon("RCLootCouncil_Classic")
local RCPreLoot = addon:NewModule("RCPreLoot", "AceComm-3.0", "AceConsole-3.0", "AceHook-3.0", "AceEvent-3.0", "AceTimer-3.0", "AceSerializer-3.0", "AceBucket-3.0")

function RCPreLoot:OnInitialize()    
	self.debug = true
	-- MAKESURE: Edit the following versions every update, and should also update the version in TOC file.
	self:Debug("RCPreLoot Initialized")
	self.version = "0.1.0"
	self.tVersion = nil -- format: nil/Beta.num/Alpha.num, testVersion compares only by number. eg. "Alpha.2" > "Beta.1"
	self.tocVersion = GetAddOnMetadata("RCLootCouncil_PreLoot", "Version")
	self.testTocVersion = GetAddOnMetadata("RCLootCouncil_PreLoot", "X-TestVersion") -- "" (emtyp string)/Beta.num/Alpha.num
	self.lastVersionNeedingRestart = "0.1.0"
	self.lastVersionResetSetting = "0.1.0"
	self.minRCVersion = "1.1.4"	
    self.initialize = true -- Set initialize to true, so option can be initialized correctly.
end



---------------------------------------------
-- Debug functions
---------------------------------------------

-- debug print and log
function RCPreLoot:Debug(msg, ...)
    if self.debug then
        self:DebugPrint(msg, ...)
    end
    -- addon:DebugLog("PreLoot: ", msg, ...)
end

function RCPreLoot:DebugPrint(msg, ...)
	if self.debug then
		if select("#", ...) > 0 then
			self:Print("|cffcb6700rcPreLootDebug:|r "..tostring(msg).."|cffff6767", ...)
		else
			self:Print("|cffcb6700rcPreLootDebug:|r "..tostring(msg).."|r")
		end
	end
end

---------------------------------------------
-- UI functions
---------------------------------------------

function RCPreLoot:RemoveColumn(t, column)
    for i = 1, #t do
        if t[i] and t[i].colName == column.colName then
            table.remove(t, i)
        end
    end
end

function RCPreLoot:ReinsertColumnAtTheEnd(t, column)
    self:RemoveColumn(t, column)
    table.insert(t, column)
end
