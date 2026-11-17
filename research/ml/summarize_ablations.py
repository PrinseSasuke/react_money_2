"""Summarise paired, grouped ablation results across the two saved datasets."""
import json
from pathlib import Path
import pandas as pd

ROOT=Path(__file__).resolve().parent
MODELS=('rf','mlp','transformer')
GROUPS=('none','network_io','database','http_network')


def main():
    lines=['# Зависимость моделей от групп метрик','',
      'Для RF, MLP и Transformer использованы одинаковые train/validation/test-прогоны, '
      'одинаковые окна и история. Показаны Macro-F1 и изменение относительно модели со всеми признаками: '
      'среднее ± стандартное отклонение по пяти групповым разделениям, после усреднения трёх seed внутри разделения. '
      'Разделения пересекаются по прогонам; это не доверительные интервалы.','',
      '`network_io`: исключены `net_rx_bytes`, `net_tx_bytes`, `open_conns`. '
      '`database`: исключены `pg_up`, `pg_tps`, `pg_active`, `pg_rollbacks`. '
      '`http_network`: исключены 11 показателей запросов, ошибок, задержек, соединений и сетевых байтов. '
      'Оставшиеся метрики могут коррелировать с исключёнными: абляция не доказывает отсутствие сигнала.', '',
      'В сохранённой метрике `selected_epoch_or_limit` для MLP записан выбранный предел итераций; '
      'для Transformer — общее число выполненных эпох, а номер выбранной по validation эпохи не записан. '
      'Модель при этом использует сохранённое лучшее состояние.', '']
    all_summary=[]
    for title,folder in [('Дополнительный проверенный набор','ablation_verified'),
                         ('Исторический набор','ablation_historical')]:
        out=ROOT/folder;metrics=pd.DataFrame(json.loads((out/'metrics.json').read_text(encoding='utf8')))
        if len(metrics)!=5*4*3*3:raise ValueError(f'Incomplete ablation {folder}: {len(metrics)}')
        per=metrics.groupby(['model','ablation','split'],as_index=False)[
            ['macro_f1','norm_as_attack','fault_as_attack','attack_as_fault']].mean()
        base=per[per.ablation=='none'][['model','split','macro_f1']].rename(columns={'macro_f1':'baseline'})
        per=per.merge(base,on=['model','split'],validate='many_to_one');per['delta']=per.macro_f1-per.baseline
        summary=per.groupby(['model','ablation']).agg(mean=('macro_f1','mean'),std=('macro_f1','std'),
          delta_mean=('delta','mean'),delta_std=('delta','std'),
          norm_as_attack=('norm_as_attack','mean'),fault_as_attack=('fault_as_attack','mean'),
          attack_as_fault=('attack_as_fault','mean')).reset_index()
        summary.to_csv(out/'summary.csv',index=False);summary['dataset']=folder
        all_summary.append(summary)
        lines += [f'## {title}','','| Признаки | RF | MLP | Transformer |','|---|---:|---:|---:|']
        for group in GROUPS:
            values=[]
            for model in MODELS:
                r=summary[(summary.model==model)&(summary.ablation==group)].iloc[0]
                values.append(f'{r["mean"]:.3f} ± {r["std"]:.3f} ({r.delta_mean:+.3f})')
            lines.append(f'| {group} | '+' | '.join(values)+' |')
        lines += ['',f'В скобках — среднее парное изменение Macro-F1 относительно `none`. '
                   f'Доли ошибок, разбиения и все предсказания: `{folder}/`.', '']
    lines += ['Исторический набор остаётся исследовательским: точные временные метки отсчётов '
      'и успешность инъекций не подтверждены, минутный lookback не учитывался. Дополнительный набор '
      'мал и содержит синтетические сценарии на одном стенде. Результаты описывают эти наборы, '
      'а не гарантируют переносимость в реальные сети.', '',
      'Воспроизведение: `python research/ml/ablate_models.py --data research/evidence/verified '
      '--base research/ml/verified_proportional --out research/ml/ablation_verified`; '
      'аналогично с `research/evidence/prepared`, `research/ml/historical_proportional` и '
      '`research/ml/ablation_historical`; затем `python research/ml/summarize_ablations.py`.']
    (ROOT/'ABLATION_RESULTS.md').write_text('\n'.join(lines)+'\n',encoding='utf8')
    print('\n'.join(lines))


if __name__=='__main__':main()
