import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Select, Button, Card, Row, Col, Slider, message, Upload, Tooltip, Space, Spin, Modal, Form, Input, Segmented, Switch } from 'antd'
import { DownloadOutlined, ReloadOutlined, UploadOutlined, InfoCircleOutlined, CheckOutlined } from '@ant-design/icons'
import iconUrl from '/icon.png'
import { composeImage } from './lib/composeImage'
import { logos, logoExtMap } from './data/logo'

const { Option } = Select

function App() {
  // ==================== 参数状态 ====================
  const [charScale, setCharScale] = useState(1)
  const [charPos, setCharPos] = useState(0.5)
  const [charYOffset, setCharYOffset] = useState(0.5)
  const [logoScale, setLogoScale] = useState(1)
  const [selectedLogo, setSelectedLogo] = useState(null) // null=本家, ''=无logo, 其他=指定logo
  const [outputQuality, setOutputQuality] = useState('1080p')
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [clipFeather, setClipFeather] = useState(false)

  // 预览状态
  const [loading, setLoading] = useState(false)
  const [hasRendered, setHasRendered] = useState(false)
  const canvasRef = useRef(null)

  // ==================== 角色选择区域状态 ====================
  const [artsData, setArtsData] = useState(null)
  const [artsDataLoading, setArtsDataLoading] = useState(false)
  const [artsDataError, setArtsDataError] = useState(null)

  // 上传角色列表
  const [uploadedImages, setUploadedImages] = useState([])

  // 出处筛选器
  const [selectedComefrom, setSelectedComefrom] = useState('')
  // 条件子筛选器
  const [selectedProfession, setSelectedProfession] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedStar, setSelectedStar] = useState('')
  const [selectedGender, setSelectedGender] = useState('')
  // 角色和立绘选择（这些是"暂存"状态，点确认后才生效）
  const [pendingChar, setPendingChar] = useState('')
  const [pendingSkinCode, setPendingSkinCode] = useState('')
  // 确认后的状态（实际用于合成）
  const [confirmedChar, setConfirmedChar] = useState('')
  const [confirmedSkinCode, setConfirmedSkinCode] = useState('')

  // 是否已初始化默认角色
  const [isInitialized, setIsInitialized] = useState(false)

  // ==================== 上传模态框状态 ====================
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [uploadForm] = Form.useForm()
  const [pendingUploadFile, setPendingUploadFile] = useState(null)
  const [pendingUploadDataUrl, setPendingUploadDataUrl] = useState('')

  // ==================== 数据加载 ====================
  useEffect(() => {
    const fetchArtsData = async () => {
      setArtsDataLoading(true)
      try {
        const resp = await fetch('/arts_data.json')
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const data = await resp.json()
        setArtsData(data)
      } catch (err) {
        console.error('加载角色数据失败:', err)
        setArtsDataError(err.message)
      } finally {
        setArtsDataLoading(false)
      }
    }
    fetchArtsData()
  }, [])

  // ==================== 派生数据 ====================
  const allCharRecords = useMemo(() => {
    const builtIn = artsData?.角色 || []
    const uploaded = uploadedImages.map(img => ({
      角色名: img.charName,
      外文名: img.foreignName || '',
      性别: '其他',
      立绘: [{ 编号: '1', 文件名: img.fileName, 文件链接: '' }],
      logo: img.logo || '罗德岛',
      出处: '用户上传',
      信息: {},
      _dataUrl: img.dataUrl
    }))
    return [...builtIn, ...uploaded]
  }, [artsData, uploadedImages])

  const comefromOptions = useMemo(() => {
    const builtIn = (artsData?.元信息?.角色数 || [])
      .filter(item => item.出处 !== '不限')
      .map(item => item.出处)
    const hasUploaded = uploadedImages.length > 0
    return [...builtIn, ...(hasUploaded ? ['用户上传'] : [])]
  }, [artsData, uploadedImages])

  const comefromCharList = useMemo(() => {
    if (!selectedComefrom) return []
    return allCharRecords.filter(c => c.出处 === selectedComefrom)
  }, [selectedComefrom, allCharRecords])

  const professionOptions = useMemo(() => {
    if (!selectedComefrom) return []
    const profs = [...new Set(
      comefromCharList.map(c => c.信息?.职业).filter(Boolean)
    )].sort()
    return ['不限', ...profs]
  }, [selectedComefrom, comefromCharList])

  const branchOptions = useMemo(() => {
    if (!selectedComefrom) return []
    const pool = selectedProfession && selectedProfession !== '不限'
      ? comefromCharList.filter(c => c.信息?.职业 === selectedProfession)
      : comefromCharList
    const branches = [...new Set(pool.map(c => c.信息?.分支).filter(Boolean))].sort()
    return ['不限', ...branches]
  }, [selectedComefrom, comefromCharList, selectedProfession])

  const starOptions = useMemo(() => {
    if (!selectedComefrom) return []
    const stars = [...new Set(
      comefromCharList.map(c => c.信息?.星级).filter(star => star != null)
    )].sort((a, b) => a - b)
    return ['不限', ...stars.map(String)]
  }, [selectedComefrom, comefromCharList])

  const genderOptions = useMemo(() => {
    if (!selectedComefrom) return []
    const genders = [...new Set(comefromCharList.map(c => c.性别).filter(Boolean))].sort()
    return ['不限', ...genders]
  }, [selectedComefrom, comefromCharList])

  const filteredCharList = useMemo(() => {
    if (!selectedComefrom) return []
    let filtered = comefromCharList
    if (selectedProfession && selectedProfession !== '不限') {
      filtered = filtered.filter(c => c.信息?.职业 === selectedProfession)
    }
    if (selectedBranch && selectedBranch !== '不限') {
      filtered = filtered.filter(c => c.信息?.分支 === selectedBranch)
    }
    if (selectedStar && selectedStar !== '不限') {
      filtered = filtered.filter(c => String(c.信息?.星级) === selectedStar)
    }
    if (selectedGender && selectedGender !== '不限') {
      filtered = filtered.filter(c => c.性别 === selectedGender)
    }
    return filtered
  }, [comefromCharList, selectedProfession, selectedBranch, selectedStar, selectedGender])

  const filteredCharNames = useMemo(() => {
    return [...new Set(filteredCharList.map(c => c.角色名))].sort()
  }, [filteredCharList])

  // 暂存角色对应的完整记录
  const pendingCharRecord = useMemo(() => {
    if (!pendingChar) return null
    return filteredCharList.find(c => c.角色名 === pendingChar) || null
  }, [pendingChar, filteredCharList])

  // 暂存角色的立绘列表
  const pendingCharartList = useMemo(() => {
    if (!pendingCharRecord) return []
    return pendingCharRecord.立绘 || []
  }, [pendingCharRecord])

  // 确认后的角色记录（用于合成）
  const confirmedCharRecord = useMemo(() => {
    if (!confirmedChar) return null
    // 从全量数据中查找，避免筛选器切换后找不到
    return allCharRecords.find(c => c.角色名 === confirmedChar) || null
  }, [confirmedChar, allCharRecords])

  // 确认后的立绘记录
  const confirmedCharart = useMemo(() => {
    if (!confirmedSkinCode || !confirmedCharRecord) return null
    return confirmedCharRecord.立绘?.find(p => p.编号 === confirmedSkinCode) || null
  }, [confirmedSkinCode, confirmedCharRecord])

  // ==================== 默认选择蓝毒 ====================
  useEffect(() => {
    if (isInitialized || !artsData) return
    const defaultChar = '蓝毒'
    const defaultComefrom = '方舟干员'
    const defaultSkinCode = '2' // 精二立绘
    const record = allCharRecords.find(c => c.角色名 === defaultChar && c.出处 === defaultComefrom)
    if (record) {
      setSelectedComefrom(defaultComefrom)
      setSelectedProfession('狙击')
      setSelectedBranch('速射手')
      setSelectedStar('5')
      setSelectedGender('女性')
      setPendingChar(defaultChar)
      setPendingSkinCode(defaultSkinCode)
      // 直接确认，触发首次合成
      setConfirmedChar(defaultChar)
      setConfirmedSkinCode(defaultSkinCode)
    }
    setIsInitialized(true)
  }, [artsData, allCharRecords, isInitialized])

  // ==================== 角色选择变化时自动选第一个立绘 ====================
  useEffect(() => {
    if (!pendingChar || !pendingCharRecord) return
    // 当前立绘编号在新角色中仍有效则保留
    const skins = pendingCharRecord.立绘 || []
    if (skins.some(s => s.编号 === pendingSkinCode)) return
    const firstSkin = skins[0]?.编号
    if (firstSkin) {
      setPendingSkinCode(firstSkin)
    }
  }, [pendingChar, pendingCharRecord])

  // ==================== 确认选择 ====================
  const handleConfirmSelection = () => {
    if (!pendingChar || !pendingSkinCode) {
      message.warning('请先选择角色和立绘')
      return
    }
    setConfirmedChar(pendingChar)
    setConfirmedSkinCode(pendingSkinCode)
  }

  // ==================== 上传处理 ====================
  const handleFileChange = ({ file }) => {
    if (!file || !file.originFileObj) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target.result
      const baseName = file.name.replace(/\.[^.]+$/, '')
      setPendingUploadFile(file)
      setPendingUploadDataUrl(dataUrl)
      uploadForm.setFieldsValue({
        charName: baseName,
        foreignName: baseName,
        defaultLogo: '罗德岛'
      })
      setUploadModalOpen(true)
    }
    reader.readAsDataURL(file.originFileObj)
  }

  const handleUploadModalOk = async () => {
    try {
      const values = await uploadForm.validateFields()
      const { charName, foreignName, defaultLogo } = values

      const allNames = allCharRecords.map(c => c.角色名)
      if (allNames.includes(charName)) {
        message.error(`角色名"${charName}"已存在，请修改`)
        return
      }

      const img = new window.Image()
      img.onload = () => {
        const newImage = {
          id: Date.now().toString(),
          name: charName,
          fileName: pendingUploadFile.name,
          dataUrl: pendingUploadDataUrl,
          width: img.width,
          height: img.height,
          charName,
          foreignName,
          logo: defaultLogo
        }
        const newList = [...uploadedImages, newImage]
        setUploadedImages(newList)
        // 上传后自动选择并确认，同时重置筛选器
        setSelectedComefrom('用户上传')
        setSelectedProfession('')
        setSelectedBranch('')
        setSelectedStar('')
        setSelectedGender('')
        setPendingChar(charName)
        setPendingSkinCode('1')
        setConfirmedChar(charName)
        setConfirmedSkinCode('1')
        setSelectedLogo(null)
        setUploadModalOpen(false)
        uploadForm.resetFields()
        setPendingUploadFile(null)
        setPendingUploadDataUrl('')
        message.success('立绘上传成功')
      }
      img.onerror = () => {
        message.error('图片加载失败')
        setUploadModalOpen(false)
      }
      img.src = pendingUploadDataUrl
    } catch (err) {
      // 表单校验失败，不关闭
    }
  }

  const handleUploadModalCancel = () => {
    setUploadModalOpen(false)
    uploadForm.resetFields()
    setPendingUploadFile(null)
    setPendingUploadDataUrl('')
  }

  // ==================== 参数操作 ====================
  const handleReset = () => {
    setCharScale(1)
    setCharPos(0.5)
    setCharYOffset(0.5)
    setLogoScale(1)
    setSelectedLogo(null)
    setOutputQuality('1080p')
    setAspectRatio('16:9')
    setClipFeather(false)
    message.success('参数已重置')
  }

  // ==================== 合成图片 ====================
  const getLogoPath = useCallback((logoName) => {
    if (!logoName) return null
    const ext = logoExtMap[logoName] || 'png'
    return `logos/${logoName}.${ext}`
  }, [])

  const getCanvasSize = (quality, ratio) => {
    const is43 = ratio === '4:3'
    switch (quality) {
      case '4K': return is43 ? { width: 2880, height: 2160 } : { width: 3840, height: 2160 }
      case '2K': return is43 ? { width: 1920, height: 1440 } : { width: 2560, height: 1440 }
      case '1080p': return is43 ? { width: 1440, height: 1080 } : { width: 1920, height: 1080 }
      case '720p': return is43 ? { width: 960, height: 720 } : { width: 1280, height: 720 }
      default: return is43 ? { width: 2880, height: 2160 } : { width: 3840, height: 2160 }
    }
  }

  const generateImage = useCallback(async () => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const { width, height } = getCanvasSize(outputQuality, aspectRatio)
    canvas.width = width
    canvas.height = height

    let charImage
    let charImageFallback = null
    const isUploadedChar = confirmedCharRecord?.出处 === '用户上传'

    if (isUploadedChar) {
      const uploadedImg = uploadedImages.find(img => img.charName === confirmedChar)
      if (uploadedImg) {
        charImage = uploadedImg.dataUrl
      }
    } else if (confirmedCharart) {
      // 优先本地资源，回落远程URL
      charImage = `chararts/${confirmedCharart.文件名}`
      charImageFallback = confirmedCharart.文件链接 || null
    }

    if (!charImage) return

    let logoPath = null
    const effectiveLogo = selectedLogo === null
      ? (confirmedCharRecord?.logo || '')
      : selectedLogo
    if (effectiveLogo) {
      logoPath = getLogoPath(effectiveLogo)
    }

    setLoading(true)
    try {
      const bgFile = aspectRatio === '4:3' ? 'bg-4-3.svg' : 'bg-16-9.svg'
      await composeImage(canvas, bgFile, charImage, logoPath, {
        charScale, charPos, charYOffset, logoScale, charImageFallback, clipFeather
      })
      setHasRendered(true)
    } catch (err) {
      console.error('合成失败:', err)
      message.error('图片合成失败: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [confirmedChar, confirmedCharart, confirmedCharRecord,
      selectedLogo, charScale, charPos, charYOffset, logoScale,
      uploadedImages, outputQuality, aspectRatio, clipFeather, getLogoPath])

  // 确认选择后自动合成
  useEffect(() => {
    if (!confirmedChar || !confirmedSkinCode) return
    const timer = setTimeout(() => generateImage(), 200)
    return () => clearTimeout(timer)
  }, [generateImage])

  // 参数变化时重新合成（已有确认的角色时）
  useEffect(() => {
    if (!confirmedChar || !confirmedSkinCode) return
    const timer = setTimeout(() => generateImage(), 200)
    return () => clearTimeout(timer)
  }, [charScale, charPos, charYOffset, logoScale, selectedLogo, outputQuality, aspectRatio, clipFeather]) // eslint-disable-line react-hooks/exhaustive-deps

  // 下载
  const handleDownload = () => {
    if (!hasRendered || !canvasRef.current) { message.warning('请先生成图片'); return }
    const dataUrl = canvasRef.current.toDataURL('image/png')
    const link = document.createElement('a')
    link.href = dataUrl
    let filename
    if (confirmedChar && confirmedSkinCode) {
      filename = `合成_${confirmedChar}_${confirmedSkinCode}.png`
    } else {
      filename = '合成.png'
    }
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    message.success('下载开始')
  }

  // Logo选择值
  const logoSelectValue = selectedLogo === null
    ? (confirmedCharRecord?.logo || undefined)
    : selectedLogo

  // Logo 缩略图背景色
  const logoThumbStyle = {
    width: 20,
    height: 20,
    borderRadius: 4,
    background: '#595959',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden'
  }

  return (
    <div style={{ padding: '16px 24px', maxWidth: 1800, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src={iconUrl} alt="" style={{ width: 40, height: 40 }} />
        立绘合成工具
      </h1>

      <Row gutter={[20, 20]}>
        {/* ========== 左列：功能区 ========== */}
        <Col xs={24} md={7}>
          {/* 资源选择 */}
          <Card title="资源选择" style={{ marginBottom: 16 }}>
            {artsDataLoading && <Spin tip="加载角色数据中..." />}
            {artsDataError && <div style={{ color: '#ff4d4f', marginBottom: 12 }}>数据加载失败: {artsDataError}</div>}

            {/* 角色选择 + 上传 */}
            <div style={{ marginBottom: 8 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: 13 }}>角色选择器</label>
              <Row gutter={[8, 8]}>
              <Col flex="1">
                <Select
                  style={{ width: '100%' }}
                  placeholder="选择出处"
                  value={selectedComefrom || undefined}
                  onChange={(val) => {
                    setSelectedComefrom(val)
                    setSelectedProfession('')
                    setSelectedBranch('')
                    setSelectedStar('')
                    setSelectedGender('')
                    setPendingChar('')
                    setPendingSkinCode('')
                  }}
                  allowClear
                >
                  {comefromOptions.map(cf => (
                    <Option key={cf} value={cf}>{cf}</Option>
                  ))}
                </Select>
              </Col>
              <Col>
                <Upload
                  accept="image/*"
                  showUploadList={false}
                  onChange={handleFileChange}
                  customRequest={() => {}}
                >
                  <Button icon={<UploadOutlined />}>上传</Button>
                </Upload>
              </Col>
            </Row>
            </div>

            {/* 筛选器 */}
            {selectedComefrom && (selectedComefrom === '方舟干员' || selectedComefrom === '终末地') && (
              <div style={{ marginLeft: 16, borderLeft: '2px solid #e8e8e8', paddingLeft: 12 }}>
              <>
                <Row gutter={[8, 8]} style={{ marginBottom: 8 }}>
                  <Col span={12}>
                    <Select
                      style={{ width: '100%' }}
                      placeholder="职业"
                      value={selectedProfession || undefined}
                      onChange={(val) => {
                        setSelectedProfession(val)
                        setSelectedBranch('')
                        setPendingChar('')
                        setPendingSkinCode('')
                      }}
                      allowClear
                      size="small"
                    >
                      {professionOptions.map(p => (
                        <Option key={p} value={p}>{p}</Option>
                      ))}
                    </Select>
                  </Col>
                  <Col span={12}>
                    <Select
                      style={{ width: '100%' }}
                      placeholder="分支"
                      value={selectedBranch || undefined}
                      onChange={(val) => {
                        setSelectedBranch(val)
                        setPendingChar('')
                        setPendingSkinCode('')
                      }}
                      allowClear
                      size="small"
                    >
                      {branchOptions.map(b => (
                        <Option key={b} value={b}>{b}</Option>
                      ))}
                    </Select>
                  </Col>
                </Row>
                <Row gutter={[8, 8]} style={{ marginBottom: 8 }}>
                  <Col span={12}>
                    <Select
                      style={{ width: '100%' }}
                      placeholder="星级"
                      value={selectedStar || undefined}
                      onChange={(val) => {
                        setSelectedStar(val)
                        setPendingChar('')
                        setPendingSkinCode('')
                      }}
                      allowClear
                      size="small"
                    >
                      {starOptions.map(s => (
                        <Option key={s} value={s}>{s === '不限' ? s : '★'.repeat(Number(s))}</Option>
                      ))}
                    </Select>
                  </Col>
                  <Col span={12}>
                    <Select
                      style={{ width: '100%' }}
                      placeholder="性别"
                      value={selectedGender || undefined}
                      onChange={(val) => {
                        setSelectedGender(val)
                        setPendingChar('')
                        setPendingSkinCode('')
                      }}
                      allowClear
                      size="small"
                    >
                      {genderOptions.map(g => (
                        <Option key={g} value={g}>{g}</Option>
                      ))}
                    </Select>
                  </Col>
                </Row>
              </>
              </div>
            )}

            {/* 角色 + 立绘 + 确认 */}
            {selectedComefrom && (
              <Row gutter={[8, 8]} style={{ marginBottom: 8 }}>
                <Col span={12}>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="输入名字搜索 / 选择角色"
                    value={pendingChar || undefined}
                    onChange={(val) => {
                      setPendingChar(val)
                      setPendingSkinCode('')
                    }}
                    showSearch
                    filterOption={(input, option) =>
                      option.children?.toString().toLowerCase().includes(input.toLowerCase())
                    }
                    allowClear
                    suffixIcon={<InfoCircleOutlined style={{ color: '#bfbfbf', fontSize: 12 }} title="可直接输入角色名搜索" />}
                  >
                    {filteredCharNames.map(name => (
                      <Option key={name} value={name}>{name}</Option>
                    ))}
                  </Select>
                </Col>
                <Col span={7}>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="立绘"
                    value={pendingSkinCode || undefined}
                    onChange={setPendingSkinCode}
                    disabled={!pendingChar || pendingCharartList.length === 0}
                  >
                    {pendingCharartList.map(art => (
                      <Option key={art.编号} value={art.编号}>{art.编号}</Option>
                    ))}
                  </Select>
                </Col>
                <Col span={5}>
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    onClick={handleConfirmSelection}
                    disabled={!pendingChar || !pendingSkinCode}
                    block
                  >
                    确定
                  </Button>
                </Col>
              </Row>
            )}

            {/* Logo选择 */}
            <div style={{ marginTop: 8 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: 13 }}>
                Logo
              </label>
              <Select
                style={{ width: '100%' }}
                placeholder="选择Logo（默认本家）"
                value={logoSelectValue || undefined}
                onChange={(val) => setSelectedLogo(val === '' ? '' : val)}
                allowClear
                showSearch
                filterOption={(input, option) =>
                  option.children?.toString().toLowerCase().includes(input.toLowerCase())
                }
              >
                <Option value="">(无logo)</Option>
                {logos.map(logo => (
                  <Option key={logo} value={logo}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={logoThumbStyle}>
                        <img
                          src={`logos/${logo}.${logoExtMap[logo] || 'png'}`}
                          alt=""
                          style={{ width: 16, height: 16, objectFit: 'contain', filter: 'brightness(10)' }}
                          onError={(e) => { e.target.style.display = 'none' }}
                        />
                      </span>
                      {logo}
                    </span>
                  </Option>
                ))}
              </Select>
            </div>

            {/* 角色信息 */}
            {confirmedCharRecord && (() => {
              const r = confirmedCharRecord
              const infoFields = r.信息
                ? Object.entries(r.信息)
                    .filter(([, v]) => v != null && v !== '')
                    .map(([k, v]) => {
                      if (k === '星级') return { label: k, value: '★'.repeat(v) }
                      return { label: k, value: String(v) }
                    })
                : []
              const fields = [
                { label: '角色名', value: r.角色名, bold: true },
                { label: '外文名', value: r.外文名 },
                { label: '出处', value: r.出处 },
                ...infoFields,
              ].filter(f => f.value)
              return fields.length > 0 ? (
                <Card size="small" style={{ marginTop: 12 }}>
                  <Row gutter={[16, 8]}>
                    {fields.map(f => (
                      <Col xs={24} md={8} key={f.label}>
                        <span style={{ color: '#8c8c8c', marginRight: 8, fontSize: 13 }}>{f.label}</span>
                        <span style={f.bold ? { fontWeight: 500 } : { fontSize: 13 }}>{f.value}</span>
                      </Col>
                    ))}
                  </Row>
                </Card>
              ) : null
            })()}
          </Card>
          <Card title="图像调整">
            {/* 立绘大小 */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 500, whiteSpace: 'nowrap', minWidth: 64, fontSize: 13 }}>立绘大小</span>
                <Slider min={0.5} max={2} step={0.1} value={charScale} onChange={setCharScale} style={{ flex: 1 }} />
                <span style={{ color: '#8c8c8c', minWidth: 26, textAlign: 'right', fontSize: 12 }}>{charScale.toFixed(1)}</span>
              </div>
            </div>

            {/* 横向位置 */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 500, whiteSpace: 'nowrap', minWidth: 64, fontSize: 13 }}>横向位置</span>
                <Slider min={0.3} max={0.7} step={0.01} value={charPos} onChange={setCharPos} style={{ flex: 1 }} />
                <span style={{ color: '#8c8c8c', minWidth: 26, textAlign: 'right', fontSize: 12 }}>{(charPos * 100).toFixed(0)}%</span>
              </div>
            </div>

            {/* 纵向位置 */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 500, whiteSpace: 'nowrap', minWidth: 64, fontSize: 13 }}>纵向位置</span>
                <Slider min={0.3} max={0.7} step={0.01} value={charYOffset} onChange={setCharYOffset} style={{ flex: 1 }} />
                <span style={{ color: '#8c8c8c', minWidth: 26, textAlign: 'right', fontSize: 12 }}>{(charYOffset * 100).toFixed(0)}%</span>
              </div>
            </div>

            {/* Logo大小 */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 500, whiteSpace: 'nowrap', minWidth: 64, fontSize: 13 }}>Logo大小</span>
                <Slider min={0.5} max={2} step={0.1} value={logoScale} onChange={setLogoScale} style={{ flex: 1 }} />
                <span style={{ color: '#8c8c8c', minWidth: 26, textAlign: 'right', fontSize: 12 }}>{logoScale.toFixed(1)}</span>
              </div>
            </div>

            {/* 输出质量 + 画面比例 */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: 13 }}>
                <Space size={4}>
                  尺寸和比例
                  <Tooltip title={<div style={{ lineHeight: 1.8 }}>
                    <div><b>16:9</b></div>
                    <div>4K: 3840×2160</div>
                    <div>2K: 2560×1440</div>
                    <div>1080p: 1920×1080</div>
                    <div>720p: 1280×720</div>
                    <div style={{ marginTop: 4 }}><b>4:3</b></div>
                    <div>4K: 2880×2160</div>
                    <div>2K: 1920×1440</div>
                    <div>1080p: 1440×1080</div>
                    <div>720p: 960×720</div>
                  </div>}>
                    <InfoCircleOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />
                  </Tooltip>
                </Space>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <Segmented
                  value={outputQuality}
                  onChange={setOutputQuality}
                  options={['4K', '2K', '1080p', '720p']}
                  size="middle"
                />
                <Segmented
                  value={aspectRatio}
                  onChange={setAspectRatio}
                  options={['16:9', '4:3']}
                  size="middle"
                />
              </div>
              <div style={{ marginTop: 10 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: 13 }}>
                  <Tooltip title="对立绘做平行四边形裁剪并羽化边缘，适用于不透明矩形素材">
                    <Space size={4}>
                      裁剪羽化
                      <InfoCircleOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />
                    </Space>
                  </Tooltip>
                </label>
                <Switch size="small" checked={clipFeather} onChange={setClipFeather} />
              </div>
            </div>

            {/* 操作按钮 */}
            <Row gutter={[8, 8]}>
              <Col span={12}>
                <Tooltip title="重置图像参数">
                  <Button icon={<ReloadOutlined />} onClick={handleReset} size="middle" block>重置</Button>
                </Tooltip>
              </Col>
              <Col span={12}>
                <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload} loading={loading} disabled={!hasRendered} size="middle" block>下载</Button>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* ========== 右列：预览 ========== */}
        <Col xs={24} md={17}>
          <Card title="图像预览" styles={{ body: { padding: '0px' } }}>
            <div style={{ textAlign: 'center', position: 'relative' }}>
              <canvas
                ref={canvasRef}
                style={{
                  display: hasRendered ? 'block' : 'none',
                  maxWidth: '100%',
                  maxHeight: '80vh',
                  objectFit: 'contain',
                  margin: '0 auto',
                  borderRadius: 8,
                  border: '1px solid #f0f0f0',
                  cursor: loading ? 'wait' : 'pointer'
                }}
                onClick={() => {
                  if (loading || !canvasRef.current) return
                  const url = canvasRef.current.toDataURL('image/png')
                  const w = window.open('')
                  const img = w.document.createElement('img')
                  img.src = url
                  img.style.maxWidth = '100%'
                  w.document.body.appendChild(img)
                  w.document.title = '大图预览'
                }}
              />
              {loading && hasRendered && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255, 255, 255, 0.4)', borderRadius: 8, zIndex: 1 }}>
                  <Spin />
                </div>
              )}
              {!hasRendered && (
                <div style={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                  选择角色和立绘后点击"确定"生成预览
                </div>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 上传模态框 */}
      <Modal
        title="上传立绘"
        open={uploadModalOpen}
        onOk={handleUploadModalOk}
        onCancel={handleUploadModalCancel}
        okText="确认上传"
        cancelText="取消"
      >
        <Form form={uploadForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="charName"
            label="角色名"
            rules={[{ required: true, message: '请输入角色名' }]}
          >
            <Input placeholder="输入角色名（不与已有角色重复）" />
          </Form.Item>
          <Form.Item
            name="foreignName"
            label="外文名"
          >
            <Input placeholder="输入外文名" />
          </Form.Item>
          <Form.Item
            name="defaultLogo"
            label="默认Logo"
          >
            <Select placeholder="选择Logo" showSearch filterOption={(input, option) =>
              option.children?.toString().toLowerCase().includes(input.toLowerCase())
            }>
              {logos.map(logo => (
                <Option key={logo} value={logo}>{logo}</Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 页脚 */}
      <footer style={{ marginTop: 'auto', padding: '8px', background: '#fafafa', borderRadius: '8px' }}>
        <Row justify="space-between" align="middle">
          <Col>
            <div style={{ fontSize: 14, color: '#8c8c8c' }}>© 2026 ArkCharArt</div>
          </Col>
          <Col>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Tooltip title="项目主页">
                <a href="https://github.com/3plus10i/arkcharart" target="_blank" rel="noopener noreferrer">
                  <img src="github-favicon.svg" alt="GitHub" style={{ width: 24, height: 24, display: 'block' }} />
                </a>
              </Tooltip>
              <Tooltip title="作者主站">
                <a href="https://blog.3plus10i.top" target="_blank" rel="noopener noreferrer">
                  <img src="blog-icon.ico" alt="博客" style={{ width: 24, height: 24, display: 'block' }} />
                </a>
              </Tooltip>
              <span style={{ color: '#d9d9d9' }}>|</span>
              <Tooltip title="鹰角网络 - 明日方舟">
                <a href="https://ak.hypergryph.com/" target="_blank" rel="noopener noreferrer">
                  <img src="arknights-favicon.ico" alt="明日方舟" style={{ width: 24, height: 24, display: 'block' }} />
                </a>
              </Tooltip>
              <Tooltip title="PRTS - Wiki">
                <a href="https://prts.wiki" target="_blank" rel="noopener noreferrer">
                  <img src="prts-favicon.ico" alt="PRTS" style={{ width: 24, height: 24, display: 'block' }} />
                </a>
              </Tooltip>
            </div>
          </Col>
        </Row>
      </footer>
    </div>
  )
}

export default App
