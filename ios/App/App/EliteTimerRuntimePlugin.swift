import Foundation
import Capacitor
import AVFoundation

@objc(AppBridgeViewController)
class AppBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(EliteTimerRuntimePlugin())
    }
}

private func numberValue(_ value: Any?, fallback: Double = 0) -> Double {
    if let number = value as? NSNumber {
        return number.doubleValue
    }

    if let string = value as? String, let parsed = Double(string) {
        return parsed
    }

    return fallback
}

private func integerValue(_ value: Any?, fallback: Int = 0) -> Int {
    if let number = value as? NSNumber {
        return number.intValue
    }

    if let string = value as? String, let parsed = Int(string) {
        return parsed
    }

    return fallback
}

private func stringValue(_ value: Any?) -> String? {
    if let string = value as? String, !string.isEmpty {
        return string
    }

    return nil
}

private func boolValue(_ value: Any?, fallback: Bool = false) -> Bool {
    if let bool = value as? Bool {
        return bool
    }

    if let number = value as? NSNumber {
        return number.boolValue
    }

    if let string = value as? String {
        return (string as NSString).boolValue
    }

    return fallback
}

private func stringArrayValue(_ value: Any?) -> [String] {
    if let strings = value as? [String] {
        return strings.filter { !$0.isEmpty }
    }

    if let values = value as? [Any] {
        return values.compactMap { value in
            guard let string = value as? String, !string.isEmpty else {
                return nil
            }
            return string
        }
    }

    return []
}

private func normalizeEpochMs(_ value: Any?) -> TimeInterval? {
    let parsed = numberValue(value, fallback: -1)
    if parsed <= 0 {
        return nil
    }

    if parsed > 1_000_000_000 && parsed < 100_000_000_000 {
        return parsed * 1000
    }

    return parsed
}

private func currentWallTimeMs() -> TimeInterval {
    Date().timeIntervalSince1970 * 1000
}

private func nextIntervalState(after current: String) -> String {
    if current == "rest" {
        return "black"
    }

    return current == "teal" ? "black" : "teal"
}

private let fixedWarmupPhaseDurationSec: Double = 15 * 60

private struct NativeSpeechMilestone {
    let key: String
    let atSec: Double
}

private func speechMilestones(for sessionDurationSec: Double) -> [NativeSpeechMilestone] {
    let totalSessionSeconds = max(0, sessionDurationSec)
    let warmupBoundarySec = min(fixedWarmupPhaseDurationSec, totalSessionSeconds)
    let quarterWaySec = floor(totalSessionSeconds * 0.25)
    let halfwaySec = floor(totalSessionSeconds / 2)
    let threeQuartersSec = floor(totalSessionSeconds * 0.75)
    let fiveMinutesSec = totalSessionSeconds - 300
    let oneMinuteSec = totalSessionSeconds - 60

    var milestones: [NativeSpeechMilestone] = []

    if totalSessionSeconds > 0 {
        milestones.append(NativeSpeechMilestone(key: "start_warmup", atSec: 1))
    }

    if totalSessionSeconds > warmupBoundarySec {
        milestones.append(NativeSpeechMilestone(key: "warmup_complete", atSec: warmupBoundarySec))
    }

    if quarterWaySec > warmupBoundarySec {
        milestones.append(NativeSpeechMilestone(key: "quarter_way", atSec: quarterWaySec))
    }

    if halfwaySec > warmupBoundarySec {
        milestones.append(NativeSpeechMilestone(key: "halfway", atSec: halfwaySec))
    }

    if threeQuartersSec > warmupBoundarySec {
        milestones.append(NativeSpeechMilestone(key: "three_quarters", atSec: threeQuartersSec))
    }

    if fiveMinutesSec > warmupBoundarySec {
        milestones.append(NativeSpeechMilestone(key: "five_minutes", atSec: fiveMinutesSec))
    }

    if oneMinuteSec > warmupBoundarySec {
        milestones.append(NativeSpeechMilestone(key: "one_minute", atSec: oneMinuteSec))
    }

    if totalSessionSeconds > 0 {
        milestones.append(NativeSpeechMilestone(key: "workout_complete", atSec: totalSessionSeconds))
    }

    return milestones
}

private func parseCoachingSchedule(_ value: Any?) -> [NativeSpeechMilestone] {
    guard let rawEntries = value as? [Any] else {
        return []
    }

    var milestones: [NativeSpeechMilestone] = []
    for entry in rawEntries {
        guard let dict = entry as? [String: Any] else { continue }
        guard let key = stringValue(dict["key"]) else { continue }
        let atSec = numberValue(dict["at"], fallback: -1)
        if atSec < 0 { continue }
        milestones.append(NativeSpeechMilestone(key: key, atSec: atSec))
    }
    return milestones
}

private struct NativeRuntimeSession {
    var payload: [String: Any]
    var sessionStatus: String
    var sessionStartTimeMs: TimeInterval
    var sessionDurationSec: Double
    var intervalDurationSec: Double
    var currentIntervalStartTimeMs: TimeInterval
    var currentIntervalDurationSec: Double
    var intervalCount: Int
    var intervalState: String
    var totalPausedMs: TimeInterval
    var intervalPausedMs: TimeInterval
    var isQuickAdd: Bool
    var speechEnabled: Bool
    var overtimeCuePlayed: Bool
    var speechCueKeysPlayed: Set<String>
    var coachingSchedule: [NativeSpeechMilestone]

    init?(payload: [String: Any]) {
        guard boolValue(payload["sessionActive"]) else {
            return nil
        }

        guard let sessionStartTimeMs = normalizeEpochMs(payload["sessionStartTime"]) else {
            return nil
        }

        let intervalDurationSec = max(1, numberValue(payload["intervalDuration"], fallback: 30))
        let currentIntervalDurationSec = max(
            1,
            numberValue(payload["currentIntervalDuration"], fallback: intervalDurationSec)
        )
        let currentIntervalStartTimeMs = normalizeEpochMs(payload["currentIntervalStartTime"])
            ?? sessionStartTimeMs

        self.payload = payload
        self.sessionStatus = stringValue(payload["sessionStatus"]) == "paused" ? "paused" : "running"
        self.sessionStartTimeMs = sessionStartTimeMs
        self.sessionDurationSec = max(0, numberValue(payload["sessionDuration"], fallback: 0))
        self.intervalDurationSec = intervalDurationSec
        self.currentIntervalStartTimeMs = currentIntervalStartTimeMs
        self.currentIntervalDurationSec = currentIntervalDurationSec
        self.intervalCount = max(0, integerValue(payload["intervalCount"], fallback: 0))
        self.intervalState = stringValue(payload["intervalState"]) ?? "black"
        self.totalPausedMs = max(0, numberValue(payload["totalPaused"], fallback: 0))
        self.intervalPausedMs = max(0, numberValue(payload["intervalPaused"], fallback: 0))
        self.isQuickAdd = boolValue(payload["isQuickAdd"])
        self.speechEnabled = boolValue(
            payload["speechEnabled"],
            fallback: stringValue(payload["workoutId"]) != nil
        )
        self.overtimeCuePlayed = boolValue(payload["nativeOvertimeCuePlayed"])
        self.speechCueKeysPlayed = Set(stringArrayValue(payload["nativeSpeechCueKeys"]))
        self.coachingSchedule = parseCoachingSchedule(payload["coachingSchedule"])

        self.payload["sessionActive"] = true
        self.payload["sessionStatus"] = self.sessionStatus
        self.payload["sessionStartTime"] = self.sessionStartTimeMs
        self.payload["sessionDuration"] = self.sessionDurationSec
        self.payload["intervalDuration"] = self.intervalDurationSec
        self.payload["currentIntervalStartTime"] = self.currentIntervalStartTimeMs
        self.payload["currentIntervalDuration"] = self.currentIntervalDurationSec
        self.payload["intervalCount"] = self.intervalCount
        self.payload["intervalState"] = self.intervalState
        self.payload["totalPaused"] = self.totalPausedMs
        self.payload["intervalPaused"] = self.intervalPausedMs
        self.payload["isQuickAdd"] = self.isQuickAdd
        self.payload["speechEnabled"] = self.speechEnabled
        self.payload["nativeOvertimeCuePlayed"] = self.overtimeCuePlayed
        self.payload["nativeSpeechCueKeys"] = Array(self.speechCueKeysPlayed).sorted()
        self.payload["coachingSchedule"] = self.coachingSchedule.map { ["key": $0.key, "at": $0.atSec] }
    }

    var combinedSpeechMilestones: [NativeSpeechMilestone] {
        let structural = speechMilestones(for: sessionDurationSec)
        let merged = structural + coachingSchedule
        return merged.sorted { $0.atSec < $1.atSec }
    }

    var isRunning: Bool {
        sessionStatus == "running"
    }

    var nextIntervalCueAtMs: TimeInterval {
        currentIntervalStartTimeMs + (currentIntervalDurationSec * 1000) + intervalPausedMs
    }

    var nextOvertimeCueAtMs: TimeInterval? {
        guard isRunning, sessionDurationSec > 0, !overtimeCuePlayed else {
            return nil
        }

        return sessionStartTimeMs + (sessionDurationSec * 1000) + totalPausedMs
    }

    mutating func markOvertimeCuePlayed() {
        overtimeCuePlayed = true
        payload["nativeOvertimeCuePlayed"] = true
    }

    mutating func markSpeechCuePlayed(_ key: String) {
        guard !key.isEmpty else {
            return
        }

        speechCueKeysPlayed.insert(key)
        payload["nativeSpeechCueKeys"] = Array(speechCueKeysPlayed).sorted()
    }

    mutating func mergeNativeProgress(from previous: NativeRuntimeSession?) {
        guard let previous else {
            return
        }

        let sameWorkout = stringValue(payload["workoutId"]) == stringValue(previous.payload["workoutId"])
        let sameSessionStart = abs(previous.sessionStartTimeMs - sessionStartTimeMs) <= 1000
        let sameSessionDuration = abs(previous.sessionDurationSec - sessionDurationSec) < 0.001
        let sameIntervalDuration = abs(previous.intervalDurationSec - intervalDurationSec) < 0.001

        guard sameWorkout && sameSessionStart && sameSessionDuration && sameIntervalDuration else {
            return
        }

        overtimeCuePlayed = overtimeCuePlayed || previous.overtimeCuePlayed
        speechCueKeysPlayed.formUnion(previous.speechCueKeysPlayed)
        payload["speechEnabled"] = speechEnabled
        payload["nativeOvertimeCuePlayed"] = overtimeCuePlayed
        payload["nativeSpeechCueKeys"] = Array(speechCueKeysPlayed).sorted()
    }

    func isSpeechCueManagedNatively(_ key: String) -> Bool {
        guard speechEnabled else {
            return false
        }

        return combinedSpeechMilestones.contains { milestone in
            milestone.key == key
        }
    }

    func speechCueTimeMs(for milestone: NativeSpeechMilestone) -> TimeInterval {
        sessionStartTimeMs + (milestone.atSec * 1000) + totalPausedMs
    }

    func nextPendingSpeechMilestone(availableKeys: Set<String>) -> NativeSpeechMilestone? {
        guard speechEnabled else {
            return nil
        }

        return combinedSpeechMilestones.first { milestone in
            availableKeys.contains(milestone.key) && !speechCueKeysPlayed.contains(milestone.key)
        }
    }

    mutating func updatePayload(nowMs: TimeInterval) {
        payload = projectedPayload(nowMs: nowMs)
    }

    mutating func fastForwardWithoutPlayback(
        to nowMs: TimeInterval,
        availableKeys: Set<String> = [],
        maxAdvances: Int = 4096
    ) {
        guard isRunning else {
            updatePayload(nowMs: nowMs)
            return
        }

        var advances = 0
        while nextIntervalCueAtMs <= nowMs && advances < maxAdvances {
            let boundaryMs = nextIntervalCueAtMs
            advanceInterval(at: boundaryMs)
            advances += 1
        }

        if let overtimeCueAtMs = nextOvertimeCueAtMs, overtimeCueAtMs <= nowMs {
            markOvertimeCuePlayed()
        }

        if speechEnabled {
            for milestone in combinedSpeechMilestones {
                guard !speechCueKeysPlayed.contains(milestone.key) else {
                    continue
                }
                guard availableKeys.isEmpty || availableKeys.contains(milestone.key) else {
                    continue
                }

                if speechCueTimeMs(for: milestone) <= nowMs {
                    markSpeechCuePlayed(milestone.key)
                }
            }
        }

        updatePayload(nowMs: nowMs)
    }

    mutating func advanceInterval(at boundaryMs: TimeInterval) {
        intervalCount += 1
        intervalState = nextIntervalState(after: intervalState)
        currentIntervalStartTimeMs = boundaryMs
        currentIntervalDurationSec = max(1, intervalDurationSec)
        intervalPausedMs = 0
        isQuickAdd = false

        if let overtimeCueAtMs = nextOvertimeCueAtMs, abs(boundaryMs - overtimeCueAtMs) <= 250 {
            markOvertimeCuePlayed()
        }

        updatePayload(nowMs: boundaryMs)
    }

    func projectedPayload(nowMs: TimeInterval) -> [String: Any] {
        var result = payload
        let elapsedMs = isRunning
            ? max(0, nowMs - sessionStartTimeMs - totalPausedMs)
            : max(0, numberValue(payload["elapsedMs"], fallback: 0))
        let intervalElapsedMs = isRunning
            ? max(0, nowMs - currentIntervalStartTimeMs - intervalPausedMs)
            : max(0, numberValue(payload["intervalElapsedMs"], fallback: 0))

        result["sessionActive"] = true
        result["sessionStatus"] = sessionStatus
        result["sessionStartTime"] = sessionStartTimeMs
        result["sessionDuration"] = sessionDurationSec
        result["intervalDuration"] = intervalDurationSec
        result["currentIntervalStartTime"] = currentIntervalStartTimeMs
        result["currentIntervalDuration"] = currentIntervalDurationSec
        result["intervalCount"] = intervalCount
        result["intervalState"] = intervalState
        result["totalPaused"] = totalPausedMs
        result["intervalPaused"] = intervalPausedMs
        result["elapsedMs"] = elapsedMs
        result["intervalElapsedMs"] = intervalElapsedMs
        result["isQuickAdd"] = isQuickAdd
        result["speechEnabled"] = speechEnabled
        result["nativeOvertimeCuePlayed"] = overtimeCuePlayed
        return result
    }
}

@objc(EliteTimerRuntimePlugin)
public class EliteTimerRuntimePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "EliteTimerRuntimePlugin"
    public let jsName = "EliteTimerRuntime"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "prepareRuntime", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "ensureCueingReady", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playIntervalCue", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playCountdownCue", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playSpeechCue", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startKeepAlive", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopKeepAlive", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "recoverCueing", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "upsertSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setMuted", returnType: CAPPluginReturnPromise)
    ]

    private let sessionStore = UserDefaults.standard
    private let sessionStoreKey = "eliteTimer_nativeRuntimeSession"
    private let schedulerLeeway: DispatchTimeInterval = .milliseconds(50)
    private let countdownDurationMs: Double = 3_400
    private let bellAssetName = "interval_bell"
    private let bellAssetExtension = "wav"
    private let bellAssetSubdirectory = "public/audio"
    private let speechAssetExtension = "wav"
    private let speechAssetSubdirectory = "public/audio"
    private let speechCueKeys: [String] = {
        var keys: [String] = [
            "start_warmup",
            "warmup_complete",
            "quarter_way",
            "halfway",
            "three_quarters",
            "five_minutes",
            "one_minute",
            "workout_complete"
        ]
        for i in 1...15 {
            keys.append(String(format: "warmup_coach_%02d", i))
        }
        for i in 1...30 {
            keys.append(String(format: "workout_coach_%02d", i))
        }
        return keys
    }()

    private var audioEngine: AVAudioEngine?
    private var cuePlayerNode: AVAudioPlayerNode?
    private var speechPlayerNode: AVAudioPlayerNode?
    private var keepAlivePlayerNode: AVAudioPlayerNode?
    private var cueBuffer: AVAudioPCMBuffer?
    private var countdownCueBuffers: [AVAudioPCMBuffer] = []
    private var speechBuffers: [String: AVAudioPCMBuffer] = [:]
    private var keepAliveLoopBuffer: AVAudioPCMBuffer?
    private var intervalTimer: DispatchSourceTimer?
    private var overtimeTimer: DispatchSourceTimer?
    private var speechTimer: DispatchSourceTimer?
    private var currentSession: NativeRuntimeSession?
    private var isMuted: Bool = false

    @objc override public func load() {
        do {
            try prepareAudioRuntime()
        } catch {
            NSLog("EliteTimerRuntime failed to prepare on load: \(error.localizedDescription)")
        }

        let restoredStoredSession = restoreStoredSessionIfNeeded()
        refreshSessionRuntime(catchUpMissedMilestones: restoredStoredSession)
    }

    @objc func prepareRuntime(_ call: CAPPluginCall) {
        do {
            try prepareAudioRuntime()
            let restoredStoredSession = restoreStoredSessionIfNeeded()
            refreshSessionRuntime(catchUpMissedMilestones: restoredStoredSession)
            call.resolve(runtimeStatus(sessionPayload: projectedCurrentSessionPayload()))
        } catch {
            call.reject("Failed to prepare native interval runtime", nil, error)
        }
    }

    @objc func ensureCueingReady(_ call: CAPPluginCall) {
        do {
            try prepareAudioRuntime()
            refreshSessionRuntime()
            call.resolve(runtimeStatus(sessionPayload: projectedCurrentSessionPayload()))
        } catch {
            call.reject("Failed to ready native cueing", nil, error)
        }
    }

    @objc func playIntervalCue(_ call: CAPPluginCall) {
        do {
            try prepareAudioRuntime()
            playCueBuffer(cueBuffer)
            call.resolve(runtimeStatus(sessionPayload: projectedCurrentSessionPayload()))
        } catch {
            call.reject("Failed to play interval cue", nil, error)
        }
    }

    @objc func playCountdownCue(_ call: CAPPluginCall) {
        do {
            try prepareAudioRuntime()

            let delays: [TimeInterval] = [0, 1, 2, 3]
            delays.enumerated().forEach { index, delay in
                DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                    guard let self else { return }
                    do {
                        try self.prepareAudioRuntime()
                        let countdownBuffer = self.countdownCueBuffers.indices.contains(index)
                            ? self.countdownCueBuffers[index]
                            : self.cueBuffer
                        self.playCueBuffer(countdownBuffer)
                    } catch {
                        NSLog("EliteTimerRuntime countdown cue failed: \(error.localizedDescription)")
                    }
                }
            }

            var payload = runtimeStatus(sessionPayload: projectedCurrentSessionPayload())
            payload["countdownDurationMs"] = countdownDurationMs
            call.resolve(payload)
        } catch {
            call.reject("Failed to schedule countdown cues", nil, error)
        }
    }

    @objc func playSpeechCue(_ call: CAPPluginCall) {
        let key = call.getString("key") ?? "unknown"
        do {
            try prepareAudioRuntime()

            if var session = currentSession, session.isRunning {
                if session.speechEnabled && session.isSpeechCueManagedNatively(key) {
                    if !session.speechCueKeysPlayed.contains(key) && !key.isEmpty {
                        playSpeechBuffer(for: key)
                        NSLog("[runtime] native.speech_played {\"key\":\"\(key)\",\"source\":\"bridge\"}")
                        session.markSpeechCuePlayed(key)
                        currentSession = session
                        persistCurrentSession()
                        scheduleSpeechTimer()
                    }
                } else if session.speechEnabled && !key.isEmpty {
                    playSpeechBuffer(for: key)
                    NSLog("[runtime] native.speech_played {\"key\":\"\(key)\",\"source\":\"bridge\"}")
                }
            } else if !key.isEmpty {
                playSpeechBuffer(for: key)
                NSLog("[runtime] native.speech_played {\"key\":\"\(key)\",\"source\":\"bridge\"}")
            }

            var payload = runtimeStatus(sessionPayload: projectedCurrentSessionPayload())
            payload["key"] = key
            call.resolve(payload)
        } catch {
            call.reject("Failed to play speech cue", nil, error)
        }
    }

    @objc func startKeepAlive(_ call: CAPPluginCall) {
        do {
            try prepareAudioRuntime()
            startKeepAlivePlayback()
            refreshSessionRuntime()
            call.resolve(runtimeStatus(sessionPayload: projectedCurrentSessionPayload()))
        } catch {
            call.reject("Failed to start native keepalive", nil, error)
        }
    }

    @objc func stopKeepAlive(_ call: CAPPluginCall) {
        cancelIntervalTimer()
        cancelOvertimeTimer()
        cancelSpeechTimer()
        stopKeepAlivePlayback()
        call.resolve(runtimeStatus(sessionPayload: projectedCurrentSessionPayload()))
    }

    @objc func recoverCueing(_ call: CAPPluginCall) {
        do {
            rebuildAudioRuntime()
            try prepareAudioRuntime()
            refreshSessionRuntime()
            call.resolve(runtimeStatus(sessionPayload: projectedCurrentSessionPayload()))
        } catch {
            call.reject("Failed to recover native cueing", nil, error)
        }
    }

    @objc func upsertSession(_ call: CAPPluginCall) {
        let sessionPayload = (call.options ?? [:]).reduce(into: [String: Any]()) { partialResult, entry in
            partialResult[String(describing: entry.key)] = entry.value
        }

        guard let session = NativeRuntimeSession(payload: sessionPayload) else {
            call.reject("Failed to parse mirrored session payload")
            return
        }

        var mergedSession = session
        mergedSession.mergeNativeProgress(from: currentSession)
        currentSession = mergedSession
        persistCurrentSession()
        refreshSessionRuntime()
        call.resolve(runtimeStatus(sessionPayload: projectedCurrentSessionPayload()))
    }

    @objc func clearSession(_ call: CAPPluginCall) {
        currentSession = nil
        cancelIntervalTimer()
        cancelOvertimeTimer()
        cancelSpeechTimer()
        stopKeepAlivePlayback()
        sessionStore.removeObject(forKey: sessionStoreKey)
        call.resolve(runtimeStatus())
    }

    @objc func setMuted(_ call: CAPPluginCall) {
        isMuted = call.getBool("muted") ?? false
        NSLog("[runtime] native.mute_toggled {\"muted\":\(isMuted)}")
        call.resolve(runtimeStatus(sessionPayload: projectedCurrentSessionPayload()))
    }

    @objc func readSession(_ call: CAPPluginCall) {
        let restoredStoredSession = restoreStoredSessionIfNeeded()
        refreshSessionRuntime(catchUpMissedMilestones: restoredStoredSession)
        call.resolve(runtimeStatus(sessionPayload: projectedCurrentSessionPayload()))
    }

    private func runtimeStatus(sessionPayload: [String: Any]? = nil) -> [String: Any] {
        var payload: [String: Any] = [
            "platform": "native-shell",
            "nativeShell": true,
            "nativePluginAvailable": true,
            "ready": isCueRuntimeReady(),
            "speechEnabled": isSpeechRuntimeReady(),
            "ownsCueScheduling": true,
            "ownsSpeechScheduling": true
        ]
        payload["session"] = sessionPayload ?? NSNull()
        return payload
    }

    private func projectedCurrentSessionPayload(nowMs: TimeInterval = currentWallTimeMs()) -> [String: Any]? {
        guard let session = currentSession else {
            return nil
        }

        return session.projectedPayload(nowMs: nowMs)
    }

    private func restoreStoredSessionIfNeeded() -> Bool {
        guard currentSession == nil else {
            return false
        }

        guard let storedSession = loadStoredSession() else {
            return false
        }

        currentSession = storedSession
        return true
    }

    private func loadStoredSession() -> NativeRuntimeSession? {
        guard let data = sessionStore.data(forKey: sessionStoreKey) else {
            return nil
        }

        do {
            let object = try JSONSerialization.jsonObject(with: data, options: [])
            guard let payload = object as? [String: Any] else {
                return nil
            }
            return NativeRuntimeSession(payload: payload)
        } catch {
            NSLog("EliteTimerRuntime failed to load stored session: \(error.localizedDescription)")
            return nil
        }
    }

    private func persistCurrentSession(nowMs: TimeInterval = currentWallTimeMs()) {
        guard var session = currentSession else {
            sessionStore.removeObject(forKey: sessionStoreKey)
            return
        }

        session.updatePayload(nowMs: nowMs)
        currentSession = session

        do {
            let data = try JSONSerialization.data(withJSONObject: session.payload, options: [])
            sessionStore.set(data, forKey: sessionStoreKey)
        } catch {
            NSLog("EliteTimerRuntime failed to persist session: \(error.localizedDescription)")
        }
    }

    private func refreshSessionRuntime(catchUpMissedMilestones: Bool = false) {
        guard var session = currentSession else {
            cancelIntervalTimer()
            cancelOvertimeTimer()
            cancelSpeechTimer()
            stopKeepAlivePlayback()
            return
        }

        if !session.isRunning {
            currentSession = session
            persistCurrentSession()
            cancelIntervalTimer()
            cancelOvertimeTimer()
            cancelSpeechTimer()
            stopKeepAlivePlayback()
            return
        }

        let nowMs = currentWallTimeMs()
        if catchUpMissedMilestones {
            session.fastForwardWithoutPlayback(to: nowMs, availableKeys: Set(speechBuffers.keys))
        } else {
            session.updatePayload(nowMs: nowMs)
        }
        currentSession = session
        persistCurrentSession(nowMs: nowMs)

        do {
            try prepareAudioRuntime()
            startKeepAlivePlayback()
        } catch {
            NSLog("EliteTimerRuntime failed to refresh runtime: \(error.localizedDescription)")
        }

        scheduleIntervalTimer()
        scheduleOvertimeTimer()
        scheduleSpeechTimer()
    }

    private func scheduleIntervalTimer() {
        cancelIntervalTimer()

        guard let session = currentSession, session.isRunning else {
            return
        }

        let nowMs = currentWallTimeMs()
        let nextCueAtMs = session.nextIntervalCueAtMs
        let delayMs = max(1, nextCueAtMs - nowMs)
        let timer = DispatchSource.makeTimerSource(queue: DispatchQueue.main)
        timer.schedule(
            deadline: .now() + .milliseconds(Int(delayMs.rounded(.up))),
            leeway: schedulerLeeway
        )
        timer.setEventHandler { [weak self] in
            self?.handleIntervalTimerFired()
        }
        timer.resume()
        intervalTimer = timer
    }

    private func scheduleOvertimeTimer() {
        cancelOvertimeTimer()

        guard let session = currentSession, session.isRunning, let overtimeCueAtMs = session.nextOvertimeCueAtMs else {
            return
        }

        if abs(overtimeCueAtMs - session.nextIntervalCueAtMs) <= 250 {
            return
        }

        let nowMs = currentWallTimeMs()
        let delayMs = max(1, overtimeCueAtMs - nowMs)
        let timer = DispatchSource.makeTimerSource(queue: DispatchQueue.main)
        timer.schedule(
            deadline: .now() + .milliseconds(Int(delayMs.rounded(.up))),
            leeway: schedulerLeeway
        )
        timer.setEventHandler { [weak self] in
            self?.handleOvertimeTimerFired()
        }
        timer.resume()
        overtimeTimer = timer
    }

    private func cancelIntervalTimer() {
        intervalTimer?.cancel()
        intervalTimer = nil
    }

    private func cancelOvertimeTimer() {
        overtimeTimer?.cancel()
        overtimeTimer = nil
    }

    private func scheduleSpeechTimer() {
        cancelSpeechTimer()

        guard let session = currentSession, session.isRunning else {
            return
        }

        let availableKeys = Set(speechBuffers.keys)
        guard let milestone = session.nextPendingSpeechMilestone(availableKeys: availableKeys) else {
            return
        }

        let nowMs = currentWallTimeMs()
        let delayMs = max(1, session.speechCueTimeMs(for: milestone) - nowMs)
        let timer = DispatchSource.makeTimerSource(queue: DispatchQueue.main)
        timer.schedule(
            deadline: .now() + .milliseconds(Int(delayMs.rounded(.up))),
            leeway: schedulerLeeway
        )
        timer.setEventHandler { [weak self] in
            self?.handleSpeechTimerFired(expectedKey: milestone.key)
        }
        timer.resume()
        speechTimer = timer
        NSLog("[runtime] native.speech_scheduled {\"key\":\"\(milestone.key)\",\"delayMs\":\(Int(delayMs.rounded(.up)))}")
    }

    private func cancelSpeechTimer() {
        speechTimer?.cancel()
        speechTimer = nil
    }

    private func handleIntervalTimerFired() {
        guard var session = currentSession, session.isRunning else {
            return
        }

        let boundaryMs = session.nextIntervalCueAtMs

        do {
            try prepareAudioRuntime()
            playCueBuffer(cueBuffer)
        } catch {
            NSLog("EliteTimerRuntime interval cue failed: \(error.localizedDescription)")
        }

        session.advanceInterval(at: boundaryMs)
        currentSession = session
        persistCurrentSession(nowMs: max(boundaryMs, currentWallTimeMs()))
        refreshSessionRuntime()
    }

    private func handleOvertimeTimerFired() {
        guard var session = currentSession, session.isRunning, !session.overtimeCuePlayed else {
            return
        }

        do {
            try prepareAudioRuntime()
            playCueBuffer(cueBuffer)
        } catch {
            NSLog("EliteTimerRuntime overtime cue failed: \(error.localizedDescription)")
        }

        session.markOvertimeCuePlayed()
        session.updatePayload(nowMs: currentWallTimeMs())
        currentSession = session
        persistCurrentSession()
        scheduleOvertimeTimer()
    }

    private func handleSpeechTimerFired(expectedKey: String) {
        guard var session = currentSession, session.isRunning, session.speechEnabled else {
            return
        }

        guard !session.speechCueKeysPlayed.contains(expectedKey) else {
            scheduleSpeechTimer()
            return
        }

        do {
            try prepareAudioRuntime()
            playSpeechBuffer(for: expectedKey)
            NSLog("[runtime] native.speech_played {\"key\":\"\(expectedKey)\",\"source\":\"timer\"}")
        } catch {
            NSLog("EliteTimerRuntime speech cue failed: \(error.localizedDescription)")
        }

        session.markSpeechCuePlayed(expectedKey)
        currentSession = session
        persistCurrentSession()
        scheduleSpeechTimer()
    }

    private func isCueRuntimeReady() -> Bool {
        guard
            let audioEngine,
            let cuePlayerNode,
            let speechPlayerNode,
            let keepAlivePlayerNode,
            cueBuffer != nil,
            !countdownCueBuffers.isEmpty,
            keepAliveLoopBuffer != nil
        else {
            return false
        }

        return audioEngine.isRunning
            && cuePlayerNode.engine != nil
            && speechPlayerNode.engine != nil
            && keepAlivePlayerNode.engine != nil
    }

    private func isSpeechRuntimeReady() -> Bool {
        guard let speechPlayerNode, !speechBuffers.isEmpty else {
            return false
        }

        return speechPlayerNode.engine != nil
    }

    private func prepareAudioRuntime() throws {
        try configureAudioSession()
        if audioEngine == nil
            || cuePlayerNode == nil
            || speechPlayerNode == nil
            || keepAlivePlayerNode == nil
            || cueBuffer == nil
            || keepAliveLoopBuffer == nil {
            try buildAudioRuntime()
        }

        guard let audioEngine else {
            throw NSError(
                domain: "EliteTimerRuntime",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Audio engine is unavailable"]
            )
        }

        if !audioEngine.isRunning {
            audioEngine.prepare()
            try audioEngine.start()
        }
    }

    private func configureAudioSession() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try session.setActive(true)
    }

    private func buildAudioRuntime() throws {
        let engine = AVAudioEngine()
        let cuePlayer = AVAudioPlayerNode()
        let speechPlayer = AVAudioPlayerNode()
        let keepAlivePlayer = AVAudioPlayerNode()
        let format = AVAudioFormat(standardFormatWithSampleRate: 44_100, channels: 1)

        guard let format else {
            throw NSError(
                domain: "EliteTimerRuntime",
                code: 2,
                userInfo: [NSLocalizedDescriptionKey: "Unable to create audio format"]
            )
        }

        engine.attach(cuePlayer)
        engine.attach(speechPlayer)
        engine.attach(keepAlivePlayer)
        engine.connect(cuePlayer, to: engine.mainMixerNode, format: format)

        cueBuffer = loadBellBufferFromBundle() ?? makeBellBuffer(format: format)
        countdownCueBuffers = [
            makeBeepBuffer(format: format, frequency: 880, duration: 0.2),
            makeBeepBuffer(format: format, frequency: 880, duration: 0.2),
            makeBeepBuffer(format: format, frequency: 880, duration: 0.2),
            makeBeepBuffer(format: format, frequency: 1760, duration: 0.4)
        ].compactMap { $0 }
        speechBuffers = loadSpeechBuffersFromBundle()
        if let speechBuffer = speechBuffers.values.first {
            engine.connect(speechPlayer, to: engine.mainMixerNode, format: speechBuffer.format)
        } else {
            engine.connect(speechPlayer, to: engine.mainMixerNode, format: format)
        }
        engine.connect(keepAlivePlayer, to: engine.mainMixerNode, format: format)
        keepAliveLoopBuffer = makeSilenceBuffer(format: format, duration: 1.0)
        audioEngine = engine
        cuePlayerNode = cuePlayer
        speechPlayerNode = speechPlayer
        keepAlivePlayerNode = keepAlivePlayer

        engine.prepare()
        try engine.start()
    }

    private func rebuildAudioRuntime() {
        cancelIntervalTimer()
        cancelOvertimeTimer()
        stopKeepAlivePlayback()
        cuePlayerNode?.stop()
        speechPlayerNode?.stop()
        audioEngine?.stop()
        audioEngine = nil
        cuePlayerNode = nil
        speechPlayerNode = nil
        keepAlivePlayerNode = nil
        cueBuffer = nil
        countdownCueBuffers = []
        speechBuffers = [:]
        keepAliveLoopBuffer = nil
    }

    private func startKeepAlivePlayback() {
        guard let keepAlivePlayerNode, let keepAliveLoopBuffer else {
            return
        }

        if keepAlivePlayerNode.isPlaying {
            return
        }

        keepAlivePlayerNode.stop()
        keepAlivePlayerNode.scheduleBuffer(keepAliveLoopBuffer, at: nil, options: [.loops], completionHandler: nil)
        keepAlivePlayerNode.play()
    }

    private func stopKeepAlivePlayback() {
        keepAlivePlayerNode?.stop()
    }

    private func playCueBuffer(_ buffer: AVAudioPCMBuffer?) {
        guard let cuePlayerNode, let buffer else {
            return
        }

        if isMuted {
            return
        }

        if cuePlayerNode.isPlaying {
            cuePlayerNode.stop()
        }

        cuePlayerNode.scheduleBuffer(buffer, at: nil, options: []) {
            // no-op
        }

        if !cuePlayerNode.isPlaying {
            cuePlayerNode.play()
        }
    }

    private func playSpeechBuffer(for key: String) {
        guard let speechPlayerNode, let buffer = speechBuffers[key] else {
            return
        }

        if isMuted {
            return
        }

        if speechPlayerNode.isPlaying {
            speechPlayerNode.stop()
        }

        speechPlayerNode.scheduleBuffer(buffer, at: nil, options: []) {
            // no-op
        }

        if !speechPlayerNode.isPlaying {
            speechPlayerNode.play()
        }
    }

    private func loadBellBufferFromBundle() -> AVAudioPCMBuffer? {
        guard let assetURL = Bundle.main.url(
            forResource: bellAssetName,
            withExtension: bellAssetExtension,
            subdirectory: bellAssetSubdirectory
        ) else {
            return nil
        }

        do {
            let audioFile = try AVAudioFile(forReading: assetURL)
            let frameCapacity = AVAudioFrameCount(audioFile.length)
            guard let buffer = AVAudioPCMBuffer(
                pcmFormat: audioFile.processingFormat,
                frameCapacity: frameCapacity
            ) else {
                return nil
            }

            try audioFile.read(into: buffer)
            return buffer
        } catch {
            NSLog("EliteTimerRuntime failed to load bundled bell asset: \(error.localizedDescription)")
            return nil
        }
    }

    private func loadSpeechBuffersFromBundle() -> [String: AVAudioPCMBuffer] {
        var buffers: [String: AVAudioPCMBuffer] = [:]
        var referenceFormat: AVAudioFormat?

        speechCueKeys.forEach { key in
            guard let buffer = loadAudioBufferFromBundle(
                forResource: key,
                withExtension: speechAssetExtension,
                subdirectory: speechAssetSubdirectory
            ) else {
                return
            }

            if let referenceFormat,
               (
                buffer.format.sampleRate != referenceFormat.sampleRate
                || buffer.format.channelCount != referenceFormat.channelCount
               ) {
                NSLog("EliteTimerRuntime skipped speech asset with mismatched format: \(key)")
                return
            }

            referenceFormat = referenceFormat ?? buffer.format
            buffers[key] = buffer
        }

        return buffers
    }

    private func loadAudioBufferFromBundle(
        forResource resource: String,
        withExtension assetExtension: String,
        subdirectory: String
    ) -> AVAudioPCMBuffer? {
        guard let assetURL = Bundle.main.url(
            forResource: resource,
            withExtension: assetExtension,
            subdirectory: subdirectory
        ) else {
            return nil
        }

        do {
            let audioFile = try AVAudioFile(forReading: assetURL)
            let frameCapacity = AVAudioFrameCount(audioFile.length)
            guard let buffer = AVAudioPCMBuffer(
                pcmFormat: audioFile.processingFormat,
                frameCapacity: frameCapacity
            ) else {
                return nil
            }

            try audioFile.read(into: buffer)
            return buffer
        } catch {
            NSLog("EliteTimerRuntime failed to load bundled audio asset (\(resource)): \(error.localizedDescription)")
            return nil
        }
    }

    private func makeBellBuffer(format: AVAudioFormat) -> AVAudioPCMBuffer? {
        let sampleRate = format.sampleRate
        let duration = 0.7
        let frameCapacity = AVAudioFrameCount(duration * sampleRate)
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCapacity) else {
            return nil
        }

        buffer.frameLength = frameCapacity

        guard let channelData = buffer.floatChannelData?[0] else {
            return nil
        }

        for frame in 0 ..< Int(frameCapacity) {
            let t = Double(frame) / sampleRate
            let attack = min(1.0, t / 0.0008)
            let decay = exp(-t * 5.5)
            let envelope = attack * decay
            var sample = 0.0
            sample += sin(2.0 * Double.pi * 3520 * t) * 0.3
            sample += sin(2.0 * Double.pi * 5280 * t) * 0.25
            sample += sin(2.0 * Double.pi * 7920 * t) * 0.2
            sample += sin(2.0 * Double.pi * 10560 * t) * exp(-t * 8.0) * 0.12
            sample += sin(2.0 * Double.pi * 13200 * t) * exp(-t * 14.0) * 0.06

            let shapedSample = max(-1.0, min(1.0, sample * envelope * 0.45))
            channelData[frame] = Float(shapedSample)
        }

        return buffer
    }

    private func makeBeepBuffer(
        format: AVAudioFormat,
        frequency: Double,
        duration: Double
    ) -> AVAudioPCMBuffer? {
        let sampleRate = format.sampleRate
        let frameCapacity = AVAudioFrameCount(duration * sampleRate)
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCapacity) else {
            return nil
        }

        buffer.frameLength = frameCapacity

        guard let channelData = buffer.floatChannelData?[0] else {
            return nil
        }

        for frame in 0 ..< Int(frameCapacity) {
            let t = Double(frame) / sampleRate
            let envelope = t < 0.01 ? (t / 0.01) : exp(-(t - 0.01) * 6.0)
            let sample = sin(2.0 * Double.pi * frequency * t) * envelope * 0.5
            channelData[frame] = Float(sample)
        }

        return buffer
    }

    private func makeSilenceBuffer(
        format: AVAudioFormat,
        duration: Double
    ) -> AVAudioPCMBuffer? {
        let sampleRate = format.sampleRate
        let frameCapacity = AVAudioFrameCount(duration * sampleRate)
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCapacity) else {
            return nil
        }

        buffer.frameLength = frameCapacity

        guard let channelData = buffer.floatChannelData?[0] else {
            return nil
        }

        for frame in 0 ..< Int(frameCapacity) {
            channelData[frame] = 0
        }

        return buffer
    }
}
